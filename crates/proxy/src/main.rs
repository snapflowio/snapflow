// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::{Router, http::Method, middleware};

use proxy::config::Config;
use proxy::middleware::cors_middleware;
use proxy::routes;
use proxy::state;
use tokio::net::TcpListener;
use tower_http::cors::{AllowHeaders, AllowOrigin, CorsLayer};
use tracing::{error, info};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "proxy=info".into()),
        )
        .init();

    // Load proxy config
    let _ = dotenvy::dotenv();
    let config = Config::from_env()?;
    config.validate()?;
    let preview_warning_enabled = config.preview_warning_enabled;
    let port = config.proxy_port;

    let state = state::build_state(config).await?;

    // Setup CORS
    let cors = CorsLayer::default()
        .allow_origin(AllowOrigin::mirror_request())
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
            Method::OPTIONS,
            Method::HEAD,
        ])
        .allow_headers(AllowHeaders::mirror_request());

    // Setup routes and health check endpoint
    let mut app = Router::default()
        .route("/health", axum::routing::get(routes::health::health))
        .fallback(routes::proxy::proxy_handler)
        .layer(cors)
        .layer(middleware::from_fn(cors_middleware));

    // Determine if the preview warning page for sandbox should be shown
    if preview_warning_enabled {
        app = app.layer(middleware::from_fn(routes::warning::warning_middleware));
    }

    // Create a instance of app with state
    let app = app.with_state(state);
    let addr = format!("0.0.0.0:{port}");
    let listener = TcpListener::bind(&addr).await?;
    info!(port, "proxy server is running");

    // Serve the application
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| {
            error!(error = %e, "server error");
            anyhow::anyhow!("server error: {e}")
        })
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    tokio::select! {
        _ = ctrl_c => info!("received Ctrl+C, shutting down"),
        _ = terminate => info!("received SIGTERM, shutting down"),
    }
}
