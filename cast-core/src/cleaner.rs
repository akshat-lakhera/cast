use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tracing::{debug, info};

/// Storage usage report
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StorageReport {
    pub total_size_mb: f64,
    pub pdb_size_mb: f64,
    pub incremental_size_mb: f64,
    pub temp_size_mb: f64,
    pub file_count: usize,
}

/// Result of a cache cleaning operation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CleanResult {
    pub freed_bytes: u64,
    pub freed_mb: f64,
    pub files_deleted: usize,
    pub remaining_size_mb: f64,
}

/// Automatic cache and storage cleaner for CAST
pub struct AutoCleaner {
    /// Threshold in megabytes before automatic sweep triggers (e.g. 250 MB)
    pub max_cache_mb: f64,
    /// Known cache and target directories to manage
    pub search_dirs: Vec<PathBuf>,
}

impl AutoCleaner {
    /// Create a new AutoCleaner with default targets
    pub fn new(max_cache_mb: f64) -> Self {
        let mut search_dirs = Vec::new();

        // 1. Project target directory
        if let Ok(manifest_dir) = std::env::current_dir() {
            search_dirs.push(manifest_dir.join("target"));
            search_dirs.push(manifest_dir.join("cast-core").join("target"));
        }

        // 2. Custom cargo target directory if configured
        if let Ok(custom_target) = std::env::var("CARGO_TARGET_DIR") {
            search_dirs.push(PathBuf::from(custom_target));
        }

        // 3. User home cargo cast-target fallback
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            search_dirs.push(PathBuf::from(user_profile).join(".cargo").join("cast-target"));
        }

        // 4. Temporary snapshot directory
        search_dirs.push(std::env::temp_dir().join("cast_frames"));

        Self {
            max_cache_mb,
            search_dirs,
        }
    }

    /// Calculate total disk usage across all managed cache directories
    pub fn get_storage_report(&self) -> StorageReport {
        let mut total_bytes: u64 = 0;
        let mut pdb_bytes: u64 = 0;
        let mut incremental_bytes: u64 = 0;
        let mut temp_bytes: u64 = 0;
        let mut file_count: usize = 0;

        for dir in &self.search_dirs {
            if !dir.exists() {
                continue;
            }
            Self::measure_dir_recursive(
                dir,
                &mut total_bytes,
                &mut pdb_bytes,
                &mut incremental_bytes,
                &mut temp_bytes,
                &mut file_count,
            );
        }

        StorageReport {
            total_size_mb: bytes_to_mb(total_bytes),
            pdb_size_mb: bytes_to_mb(pdb_bytes),
            incremental_size_mb: bytes_to_mb(incremental_bytes),
            temp_size_mb: bytes_to_mb(temp_bytes),
            file_count,
        }
    }

    /// Recursively measure file sizes
    fn measure_dir_recursive(
        dir: &Path,
        total: &mut u64,
        pdb: &mut u64,
        incremental: &mut u64,
        temp: &mut u64,
        files: &mut usize,
    ) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let is_inc = path.to_string_lossy().contains("incremental");
                    Self::measure_dir_recursive(&path, total, pdb, incremental, temp, files);
                    if is_inc {
                        // Sub-measurements already counted in total
                    }
                } else if let Ok(meta) = entry.metadata() {
                    let size = meta.len();
                    *total += size;
                    *files += 1;

                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    if ext.eq_ignore_ascii_case("pdb") {
                        *pdb += size;
                    } else if path.to_string_lossy().contains("incremental") {
                        *incremental += size;
                    } else if path.to_string_lossy().contains("cast_frames") {
                        *temp += size;
                    }
                }
            }
        }
    }

    /// Perform a safe pruning pass:
    /// - Deletes multi-hundred-megabyte `.pdb` files that accumulate from debug builds
    /// - Deletes stale `incremental/` cache directories
    /// - Deletes temporary frame files
    /// - If `aggressive` is true: purges entire target debug/deps directory
    pub fn clean_cache(&self, aggressive: bool) -> CleanResult {
        let mut freed_bytes: u64 = 0;
        let mut files_deleted: usize = 0;

        for dir in &self.search_dirs {
            if !dir.exists() {
                continue;
            }

            if aggressive && dir.ends_with("cast_frames") {
                if let Ok(_) = fs::remove_dir_all(dir) {
                    debug!("Purged temporary frames folder: {:?}", dir);
                }
                continue;
            }

            Self::clean_dir_recursive(dir, aggressive, &mut freed_bytes, &mut files_deleted);
        }

        let remaining = self.get_storage_report();
        let freed_mb = bytes_to_mb(freed_bytes);

        info!(
            "🧹 AutoCleaner: Purged {} files (Freed {:.2} MB). Remaining storage: {:.2} MB",
            files_deleted, freed_mb, remaining.total_size_mb
        );

        CleanResult {
            freed_bytes,
            freed_mb,
            files_deleted,
            remaining_size_mb: remaining.total_size_mb,
        }
    }

    /// Clean individual files inside a directory
    fn clean_dir_recursive(dir: &Path, aggressive: bool, freed: &mut u64, count: &mut usize) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                    // Remove entire incremental cache folders if aggressive or older than 1 hour
                    if dir_name == "incremental" {
                        if let Ok(meta) = fs::metadata(&path) {
                            let is_old = meta.modified().map_or(false, |m| {
                                SystemTime::now()
                                    .duration_since(m)
                                    .map(|d| d.as_secs() > 3600)
                                    .unwrap_or(false)
                            });

                            if aggressive || is_old {
                                if let Ok(_) = fs::remove_dir_all(&path) {
                                    debug!("Purged stale incremental build cache: {:?}", path);
                                    continue;
                                }
                            }
                        }
                    }

                    Self::clean_dir_recursive(&path, aggressive, freed, count);
                } else if let Ok(meta) = entry.metadata() {
                    let size = meta.len();
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                    // Targets for safe deletion:
                    // 1. Massive Windows .pdb debug symbol files
                    // 2. Old test binaries and intermediate .d files
                    // 3. Stale .rlib/.rmeta if aggressive
                    let should_delete = if ext.eq_ignore_ascii_case("pdb") {
                        true
                    } else if ext.eq_ignore_ascii_case("d") {
                        true
                    } else if file_name.starts_with("cast_core-") && ext.eq_ignore_ascii_case("exe") && aggressive {
                        true
                    } else if aggressive && (ext == "o" || ext == "obj") {
                        true
                    } else {
                        false
                    };

                    if should_delete {
                        if let Ok(_) = fs::remove_file(&path) {
                            *freed += size;
                            *count += 1;
                        }
                    }
                }
            }
        }
    }

    /// Spawn a background task that periodically checks storage and sweeps if above threshold
    pub fn spawn_auto_sweep_loop(self: std::sync::Arc<Self>, interval_minutes: u64) {
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(Duration::from_secs(interval_minutes * 60));
            loop {
                ticker.tick().await;
                let report = self.get_storage_report();
                debug!(
                    "🔍 AutoCleaner check: Current cache size = {:.2} MB (Cap = {:.2} MB)",
                    report.total_size_mb, self.max_cache_mb
                );

                if report.total_size_mb > self.max_cache_mb {
                    info!(
                        "⚠️ Storage threshold exceeded ({:.2} MB > {:.2} MB). Initiating automated cache sweep...",
                        report.total_size_mb, self.max_cache_mb
                    );
                    self.clean_cache(false);
                }
            }
        });
    }
}

fn bytes_to_mb(bytes: u64) -> f64 {
    (bytes as f64) / (1024.0 * 1024.0)
}
