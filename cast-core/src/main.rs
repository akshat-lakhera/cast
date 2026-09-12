#![allow(dead_code)]

mod bridge;
mod capture;
mod cleaner;
mod config;
mod protocol;
mod transport;

use bridge::server::BridgeServer;
use clap::{Parser, Subcommand};
use cleaner::AutoCleaner;
use config::CastConfig;
use std::sync::Arc;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "cast")]
#[command(version = "0.1.0")]
#[command(about = "CAST — Offline Screen & Audio Streaming over Bluetooth & USB")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the CAST daemon (WebSocket bridge + capture engines + storage auto-cleaner)
    Daemon {
        /// WebSocket host to bind to
        #[arg(long, default_value = "0.0.0.0")]
        host: String,

        /// WebSocket port to bind to
        #[arg(long, default_value = "8765")]
        port: u16,

        /// Max cache storage limit in megabytes before automatic sweep (default: 200MB)
        #[arg(long, default_value = "200")]
        max_cache_mb: f64,
    },

    /// Scan for nearby devices
    Scan {
        /// Transport to scan: bluetooth, usb, or all
        #[arg(long, default_value = "all")]
        transport: String,
    },

    /// Clean build artifacts, massive .pdb debug symbols, and cache files
    Clean {
        /// Perform aggressive purge (removes all intermediate compilation artifacts)
        #[arg(long, short)]
        aggressive: bool,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Daemon { host, port, max_cache_mb } => {
            info!("Starting CAST daemon on {}:{}", host, port);

            // Initialize auto-cleaner to prevent multi-gigabyte build bloat
            let cleaner = Arc::new(AutoCleaner::new(max_cache_mb));
            let initial_report = cleaner.get_storage_report();
            info!(
                "📦 Storage Monitor: Current cache = {:.2} MB (PDB symbols: {:.2} MB, Limit: {:.2} MB)",
                initial_report.total_size_mb, initial_report.pdb_size_mb, max_cache_mb
            );

            // Clean on startup if over limit
            if initial_report.total_size_mb > max_cache_mb {
                cleaner.clean_cache(false);
            }

            // Spawn background auto-cleaner sweep every 30 minutes
            cleaner.clone().spawn_auto_sweep_loop(30);

            let mut config = CastConfig::default();
            config.bridge.host = host;
            config.bridge.port = port;

            let server = BridgeServer::new(config);
            let result = server.run().await;

            // Safe shutdown cleanup
            info!("🧹 Running graceful shutdown cache sweep...");
            cleaner.clean_cache(false);

            result?;
        }

        Commands::Scan { transport } => {
            info!("Scanning for devices via: {}", transport);

            let router = transport::router::TransportRouter::new();
            let devices = match transport.as_str() {
                "bluetooth" => router.scan_bluetooth().await,
                "usb" => router.scan_usb().await,
                _ => router.scan_all().await,
            };

            println!("\n  CAST Device Scanner");
            println!("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            if devices.is_empty() {
                println!("  No devices found.");
            } else {
                for device in &devices {
                    let signal = match device.rssi_dbm {
                        Some(rssi) => format!("RSSI: {} dBm", rssi),
                        None => match device.usb_speed_mbps {
                            Some(speed) => format!("{} Mbps", speed),
                            None => "—".to_string(),
                        },
                    };
                    println!(
                        "  [{:>9}] {:30} {} ({})",
                        device.transport.to_string().to_uppercase(),
                        device.name,
                        signal,
                        device.device_type
                    );
                }
            }
            println!("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            println!("  Found {} device(s)\n", devices.len());
        }

        Commands::Clean { aggressive } => {
            let cleaner = AutoCleaner::new(200.0);
            let report_before = cleaner.get_storage_report();
            println!("\n  CAST Storage & Cache Cleaner");
            println!("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            println!("  Before: {:.2} MB across {} files", report_before.total_size_mb, report_before.file_count);
            println!("  • PDB Debug Symbols: {:.2} MB", report_before.pdb_size_mb);
            println!("  • Incremental Cache: {:.2} MB", report_before.incremental_size_mb);
            println!("  • Temp Frame Buffers: {:.2} MB", report_before.temp_size_mb);

            let result = cleaner.clean_cache(aggressive);
            println!("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            println!("  ✅ Clean complete! Freed {:.2} MB ({} files deleted).", result.freed_mb, result.files_deleted);
            println!("  Current Cache: {:.2} MB\n", result.remaining_size_mb);
        }
    }

    Ok(())
}
