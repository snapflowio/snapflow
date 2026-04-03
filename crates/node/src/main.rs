// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

mod common;
mod computer;
mod config;
mod network;
mod openapi;
mod ssh;
mod terminal;
mod toolbox;

use config::{Config, TERMINAL_PORT, TOOLBOX_API_PORT};
use std::sync::Arc;
use tokio::net::TcpListener;
use toolbox::{AppState, port::PortDetector, session::SessionController};
use tracing_subscriber::EnvFilter;
use utoipa::OpenApi;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if std::env::args().any(|a| a == "--openapi") {
        let spec = openapi::ApiDoc::openapi().to_pretty_json()?;
        println!("{spec}");
        return Ok(());
    }

    let config = Config::from_env()?;

    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(&config.log_level));

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();

    if let Some(log_path) = config.log_file_path() {
        tracing::info!(log_file = %log_path, "file logging configured");
    }

    let project_dir = config.project_dir();
    if !project_dir.exists() {
        tokio::fs::create_dir_all(&project_dir).await?;
        tracing::info!(dir = %project_dir.display(), "created project directory");
    }

    let config_dir = config.config_dir();
    tokio::fs::create_dir_all(&config_dir).await?;
    tracing::info!(config_dir = %config_dir.display(), "configuration directory");

    let computer_available = computer::check_availability();
    let computer_manager = if computer_available {
        tracing::info!("computer features available (xdotool + scrot detected)");
        Some(Arc::new(computer::ComputerManager::default()))
    } else {
        tracing::info!("computer features disabled (xdotool/scrot not found in image)");
        None
    };

    let project_dir_str = project_dir.to_string_lossy().to_string();
    let config_dir_str = config_dir.to_string_lossy().to_string();

    let network_broadcast = match network::tls::generate_ca() {
        Ok(ca_config) => {
            if let Err(e) = network::tls::install_ca_cert(&ca_config.ca_cert_pem).await {
                tracing::warn!(error = %e, "failed to install CA cert into trust store");
            }

            let broadcast = Arc::new(network::store::NetworkEventBroadcast::default());

            let dns_broadcast = Arc::clone(&broadcast);
            let dns_upstream = config.dns_upstream();
            tokio::spawn(async move {
                if let Err(e) = network::dns::run_dns_proxy(dns_upstream, dns_broadcast).await {
                    tracing::error!(error = %e, "DNS proxy error");
                }
            });

            let http_broadcast = Arc::clone(&broadcast);
            tokio::spawn(async move {
                if let Err(e) =
                    network::http_proxy::run_http_proxy(http_broadcast, ca_config.authority).await
                {
                    tracing::error!(error = %e, "HTTP MITM proxy error");
                }
            });

            tracing::info!("network interception started (DNS :53, HTTP MITM :8080)");
            Some(broadcast)
        }
        Err(e) => {
            tracing::warn!(error = %e, "failed to generate CA, network interception disabled");
            None
        }
    };

    let port_detector = Arc::new(PortDetector::default());
    let pty_manager = Arc::new(toolbox::process::pty::PtyManager::new(
        project_dir_str.clone(),
    ));
    let state = Arc::new(AppState {
        sessions: SessionController::new(config_dir_str, project_dir_str.clone()),
        pty_manager,
        port_detector: Arc::clone(&port_detector),
        lsp_servers: toolbox::lsp::LspServers::default(),
        computer: computer_manager,
        network_broadcast,
        project_dir: project_dir_str.clone(),
    });

    let detector = Arc::clone(&port_detector);
    let port_detector_handle = tokio::spawn(async move {
        detector.run().await;
    });

    let toolbox_app = toolbox::router(Arc::clone(&state), computer_available);
    tracing::info!(port = TOOLBOX_API_PORT, "starting toolbox server");
    let toolbox_listener = TcpListener::bind(("0.0.0.0", TOOLBOX_API_PORT)).await?;
    let toolbox_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(toolbox_listener, toolbox_app).await {
            tracing::error!(error = %e, "toolbox server error");
        }
    });

    let terminal_app = terminal::router(Arc::clone(&state.pty_manager));
    let terminal_listener = TcpListener::bind(("0.0.0.0", TERMINAL_PORT)).await?;
    tracing::info!(port = TERMINAL_PORT, addr = %format!("http://localhost:{TERMINAL_PORT}"), "starting terminal server");
    let terminal_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(terminal_listener, terminal_app).await {
            tracing::error!(error = %e, "terminal server error");
        }
    });

    let ssh_project_dir = project_dir_str;
    let ssh_default_dir = config.home.clone();
    let ssh_auth_token = config.auth_token.clone();
    let ssh_handle = tokio::spawn(async move {
        if let Err(e) = ssh::start(
            ssh::SSH_PORT,
            ssh_project_dir,
            ssh_default_dir,
            ssh_auth_token,
        )
        .await
        {
            tracing::error!(error = %e, "SSH server error");
        }
    });

    let shutdown = async {
        let mut sigint = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())
            .expect("failed to register SIGINT");
        let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to register SIGTERM");

        tokio::select! {
            _ = sigint.recv() => tracing::info!("received SIGINT, shutting down gracefully..."),
            _ = sigterm.recv() => tracing::info!("received SIGTERM, shutting down gracefully..."),
        }
    };

    tokio::select! {
        _ = toolbox_handle => tracing::error!("toolbox server exited unexpectedly"),
        _ = terminal_handle => tracing::error!("terminal server exited unexpectedly"),
        _ = ssh_handle => tracing::error!("SSH server exited unexpectedly"),
        _ = shutdown => {},
    }

    tracing::info!("cleaning up sessions...");
    state.sessions.cleanup().await;

    tracing::info!("stopping LSP servers...");
    state.lsp_servers.stop_all().await;

    if let Some(ref computer) = state.computer {
        tracing::info!("stopping computer processes...");
        computer::routes::shutdown_computer(computer).await;
    }

    tracing::info!("stopping port detector...");
    port_detector_handle.abort();

    tracing::info!("shutdown complete");
    Ok(())
}
