// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Router;
use axum::routing::get;
use utoipa::OpenApi;

use crate::handlers;
use crate::schemas;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::sandbox::list,
        handlers::sandbox::list_paginated,
        handlers::sandbox::create,
        handlers::sandbox::get_by_id,
        handlers::sandbox::delete,
        handlers::sandbox::start,
        handlers::sandbox::stop,
        handlers::sandbox::resize,
        handlers::sandbox::archive,
        handlers::sandbox::create_backup,
        handlers::sandbox::replace_labels,
        handlers::sandbox::update_public_status,
        handlers::sandbox::set_autostop_interval,
        handlers::sandbox::set_auto_delete_interval,
        handlers::sandbox::get_port_preview_url,
        handlers::sandbox::get_build_logs,
        handlers::sandbox::update_last_activity,
    ),
    components(schemas(
        schemas::sandbox::SandboxDto,
        schemas::sandbox::CreateSandboxDto,
        schemas::sandbox::UpdateSandboxLabelsDto,
        schemas::sandbox::PaginatedSandboxesDto,
        schemas::sandbox::PortPreviewUrlDto,
        schemas::sandbox::SandboxBucketRef,
        schemas::sandbox::BuildInfoDto,
        schemas::sandbox::CreateBuildInfoDto,
        schemas::sandbox::ResizeSandboxDto,
    ))
)]
pub struct Api;

pub fn router() -> Router<AppState> {
    Router::default()
        .route("/sandbox/paginated", get(handlers::sandbox::list_paginated))
        .route(
            "/sandbox",
            get(handlers::sandbox::list).post(handlers::sandbox::create),
        )
        .route(
            "/sandbox/{sandboxId}",
            get(handlers::sandbox::get_by_id).delete(handlers::sandbox::delete),
        )
        .route(
            "/sandbox/{sandboxId}/start",
            axum::routing::post(handlers::sandbox::start),
        )
        .route(
            "/sandbox/{sandboxId}/stop",
            axum::routing::post(handlers::sandbox::stop),
        )
        .route(
            "/sandbox/{sandboxId}/resize",
            axum::routing::post(handlers::sandbox::resize),
        )
        .route(
            "/sandbox/{sandboxId}/archive",
            axum::routing::post(handlers::sandbox::archive),
        )
        .route(
            "/sandbox/{sandboxId}/backup",
            axum::routing::post(handlers::sandbox::create_backup),
        )
        .route(
            "/sandbox/{sandboxId}/labels",
            axum::routing::put(handlers::sandbox::replace_labels),
        )
        .route(
            "/sandbox/{sandboxId}/public/{isPublic}",
            axum::routing::post(handlers::sandbox::update_public_status),
        )
        .route(
            "/sandbox/{sandboxId}/autostop/{interval}",
            axum::routing::post(handlers::sandbox::set_autostop_interval),
        )
        .route(
            "/sandbox/{sandboxId}/autodelete/{interval}",
            axum::routing::post(handlers::sandbox::set_auto_delete_interval),
        )
        .route(
            "/sandbox/{sandboxId}/ports/{port}/preview-url",
            get(handlers::sandbox::get_port_preview_url),
        )
        .route(
            "/sandbox/{sandboxId}/build-logs",
            get(handlers::sandbox::get_build_logs),
        )
        .route(
            "/sandbox/{sandboxId}/activity",
            axum::routing::post(handlers::sandbox::update_last_activity),
        )
}
