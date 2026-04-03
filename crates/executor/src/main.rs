// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

mod api;
mod cache;
mod config;
mod constants;
mod docker;
mod models;
mod netrules;
mod node;
pub mod openapi;
mod services;
mod storage;
mod sync;

use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use prometheus::{CounterVec, HistogramOpts, HistogramVec, Opts};
use tokio::net::TcpListener;
use tokio::signal;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

use cache::ExecutorCache;
use config::Config;
use docker::DockerClient;
use docker::monitor::DockerMonitor;
use netrules::NetRulesManager;
use services::metrics::MetricsService;
use services::sandbox::SandboxService;
use storage::r2::R2Client;
use sync::SandboxSyncService;

#[tokio::main]
async fn main() -> Result<()> {
    if std::env::args().any(|a| a == "--openapi") {
        let spec = <openapi::ApiDoc as utoipa::OpenApi>::openapi()
            .to_pretty_json()
            .expect("Failed to serialize OpenAPI spec");
        println!("{}", spec);
        std::process::exit(0);
    }

    let _ = dotenvy::dotenv();

    let config = Config::from_env()?;

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        format!(
            "{level},bollard=warn,hyper=warn,hyper_util=warn,aws_sdk_s3=warn,aws_config=warn,aws_smithy_runtime=warn,rustls=warn,h2=warn",
            level = config.log_level
        )
        .parse()
        .expect("hardcoded tracing filter string must be valid")
    });

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_thread_ids(false)
        .init();

    info!("Starting Snapflow executor v{}", env!("CARGO_PKG_VERSION"));

    let docker_api = bollard::Docker::connect_with_local_defaults()
        .map_err(|e| anyhow::anyhow!("Failed to connect to Docker: {}", e))?;

    info!("Connected to Docker daemon");

    let cancel_token = tokio_util::sync::CancellationToken::default();

    let cache = Arc::new(ExecutorCache::new(
        config.cache_retention_days,
        cancel_token.clone(),
    ));
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(());

    let node_path = node::write_static_binary()?;

    let net_rules_manager = Arc::new(NetRulesManager::default());

    let docker_client = Arc::new(DockerClient::new(docker::DockerClientConfig {
        api_client: docker_api,
        cache: Arc::clone(&cache),
        r2_region: config.r2_region.clone().unwrap_or_default(),
        r2_endpoint_url: config.r2_endpoint_url.clone().unwrap_or_default(),
        r2_access_key_id: config.r2_access_key_id.clone().unwrap_or_default(),
        r2_secret_access_key: config.r2_secret_access_key.clone().unwrap_or_default(),
        node_path,
        environment: config.environment.clone(),
        container_runtime: config.container_runtime.clone(),
        container_network: config.container_network.clone(),
        cancel_token: cancel_token.clone(),
        net_rules_manager: Arc::clone(&net_rules_manager),
        resource_limits_disabled: config.resource_limits_disabled,
    }));

    let monitor = Arc::new(DockerMonitor::new(
        Arc::clone(&docker_client),
        Arc::clone(&cache),
        cancel_token.clone(),
        Arc::clone(&net_rules_manager),
    ));
    info!("starting Docker event monitor");
    let monitor_handle = tokio::spawn(async move { monitor.start().await });

    let r2_client = if let (
        Some(endpoint),
        Some(key_id),
        Some(secret),
        Some(bucket),
        Some(region),
    ) = (
        &config.r2_endpoint_url,
        &config.r2_access_key_id,
        &config.r2_secret_access_key,
        &config.r2_default_bucket,
        &config.r2_region,
    ) {
        match R2Client::new(endpoint, key_id, secret, region, bucket) {
            Ok(client) => {
                info!("R2 storage client initialized");
                Some(client)
            }
            Err(e) => {
                error!(error = %e, "Failed to initialize R2 client, builds requiring context will fail");
                None
            }
        }
    } else {
        info!("R2 credentials not fully configured, storage client not initialized");
        None
    };

    let sandbox_service = Arc::new(SandboxService::new(
        Arc::clone(&cache),
        Arc::clone(&docker_client),
    ));

    let metrics_service = Arc::new(MetricsService::new(
        Arc::clone(&docker_client),
        Arc::clone(&cache),
    ));

    metrics_service.start_metrics_collection(shutdown_rx.clone());

    if let Some(ref server_url) = config.server_url {
        let sync_service = Arc::new(SandboxSyncService::new(
            Arc::clone(&docker_client),
            Duration::from_secs(10),
            server_url.clone(),
            config.api_token.clone(),
            cancel_token.clone(),
        ));
        sync_service.start();
        info!("sandbox sync service started");
    }

    let duration_opts = HistogramOpts::new(
        "container_operation_duration_seconds",
        "Time taken for container operations in seconds",
    )
    .buckets(vec![
        0.1, 0.25, 0.5, 0.75, 1.0, 2.0, 3.0, 5.0, 7.5, 10.0, 15.0, 30.0, 60.0, 120.0, 300.0,
    ]);

    let operation_duration =
        HistogramVec::new(duration_opts, &["operation"]).expect("failed to create histogram vec");
    prometheus::register(Box::new(operation_duration.clone()))?;

    let count_opts = Opts::new(
        "container_operation_total",
        "Total number of container operations",
    );
    let operation_count = CounterVec::new(count_opts, &["operation", "status"])
        .expect("failed to create counter vec");
    prometheus::register(Box::new(operation_count.clone()))?;

    let app_state = Arc::new(api::AppState {
        docker: docker_client,
        sandbox_service,
        metrics_service,
        config: config.clone(),
        r2_client,
        operation_duration,
        operation_count,
    });

    let app = api::create_router(app_state);

    let addr = format!("0.0.0.0:{}", config.api_port);

    if config.enable_tls.unwrap_or(false) {
        let cert_file = config
            .tls_cert_file
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("TLS_CERT_FILE is required when ENABLE_TLS=true"))?;
        let key_file = config
            .tls_key_file
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("TLS_KEY_FILE is required when ENABLE_TLS=true"))?;

        let tls_config = axum_server::tls_rustls::RustlsConfig::from_pem_file(cert_file, key_file)
            .await
            .map_err(|e| anyhow::anyhow!("failed to load TLS config: {}", e))?;

        info!(port = config.api_port, "Snapflow executor listening (TLS)");

        let handle = axum_server::Handle::default();
        let shutdown_handle = handle.clone();
        tokio::spawn(async move {
            shutdown_signal(shutdown_tx, cancel_token, monitor_handle).await;
            shutdown_handle.graceful_shutdown(Some(Duration::from_secs(30)));
        });

        axum_server::bind_rustls(addr.parse()?, tls_config)
            .handle(handle)
            .serve(app.into_make_service())
            .await?;
    } else {
        let listener = TcpListener::bind(&addr).await?;
        info!(port = config.api_port, "Snapflow executor listening");

        axum::serve(listener, app)
            .with_graceful_shutdown(shutdown_signal(shutdown_tx, cancel_token, monitor_handle))
            .await?;
    }

    info!("Snapflow executor shut down");
    Ok(())
}

async fn shutdown_signal(
    shutdown_tx: tokio::sync::watch::Sender<()>,
    cancel_token: tokio_util::sync::CancellationToken,
    monitor_handle: tokio::task::JoinHandle<()>,
) {
    let ctrl_c = async {
        signal::ctrl_c().await.expect("failed to listen for ctrl+c");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to listen for SIGTERM")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("Shutdown signal received, shutting down gracefully...");
    cancel_token.cancel();
    let _ = shutdown_tx.send(());
    monitor_handle.abort();
}
