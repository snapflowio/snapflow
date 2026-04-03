// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod controllers;
pub mod dto;
pub mod errors;
pub mod middleware;

use axum::Router;
use axum::routing::{any, delete, get, post};
use prometheus::{CounterVec, Encoder, HistogramVec, TextEncoder};
use std::sync::Arc;

use crate::config::Config;
use crate::docker::DockerClient;
use crate::services::metrics::MetricsService;
use crate::services::sandbox::SandboxService;
use crate::storage::r2::R2Client;

pub struct AppState {
    pub docker: Arc<DockerClient>,
    pub sandbox_service: Arc<SandboxService>,
    pub metrics_service: Arc<MetricsService>,
    pub config: Config,
    pub r2_client: Option<R2Client>,
    pub operation_duration: HistogramVec,
    pub operation_count: CounterVec,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    let public = Router::default()
        .route("/", get(controllers::health::health_check))
        .route("/metrics", get(metrics_handler));

    let protected = Router::default()
        .route("/info", get(controllers::info::executor_info))
        .route("/sandboxes", post(controllers::sandbox::create))
        .route("/sandboxes/{sandboxId}", get(controllers::sandbox::info))
        .route(
            "/sandboxes/{sandboxId}/destroy",
            post(controllers::sandbox::destroy),
        )
        .route(
            "/sandboxes/{sandboxId}/start",
            post(controllers::sandbox::start),
        )
        .route(
            "/sandboxes/{sandboxId}/stop",
            post(controllers::sandbox::stop),
        )
        .route(
            "/sandboxes/{sandboxId}/resize",
            post(controllers::sandbox::resize),
        )
        .route(
            "/sandboxes/{sandboxId}/backup",
            post(controllers::sandbox::create_backup),
        )
        .route(
            "/sandboxes/{sandboxId}",
            delete(controllers::sandbox::remove_destroyed),
        )
        .route(
            "/sandboxes/{sandboxId}/network-settings",
            post(controllers::sandbox::update_network_settings),
        )
        .route(
            "/sandboxes/{sandboxId}/network-settings",
            get(controllers::sandbox::get_network_settings),
        )
        .route(
            "/sandboxes/{sandboxId}/toolbox/{*path}",
            any(controllers::proxy::proxy_request),
        )
        .route("/images/pull", post(controllers::image::pull_image))
        .route("/images/build", post(controllers::image::build_image))
        .route("/images/tag", post(controllers::image::tag_image))
        .route("/images/exists", get(controllers::image::image_exists))
        .route("/images/info", get(controllers::image::get_image_info))
        .route("/images/remove", post(controllers::image::remove_image))
        .route("/images/logs", get(controllers::image::get_build_logs))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::auth::auth_middleware,
        ));

    public
        .merge(protected)
        .layer(axum::middleware::from_fn(
            middleware::error::error_middleware,
        ))
        .layer(axum::middleware::from_fn(
            middleware::logging::request_logging_middleware,
        ))
        .with_state(state)
}

async fn metrics_handler() -> Result<String, String> {
    let encoder = TextEncoder::default();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::default();
    encoder
        .encode(&metric_families, &mut buffer)
        .map_err(|e| format!("failed to encode metrics: {}", e))?;
    String::from_utf8(buffer).map_err(|e| format!("failed to convert metrics: {}", e))
}
