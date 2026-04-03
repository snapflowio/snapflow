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
        handlers::executor::create,
        handlers::executor::list,
        handlers::executor::update_scheduling,
        handlers::executor::get_by_sandbox_id,
        handlers::executor::get_by_image_ref,
    ),
    components(schemas(
        schemas::sandbox::ExecutorDto,
        schemas::sandbox::CreateExecutorDto,
        schemas::sandbox::ExecutorImageDto,
    ))
)]
pub struct Api;

pub fn router() -> Router<AppState> {
    Router::default()
        .route(
            "/executors/by-sandbox/{sandboxId}",
            get(handlers::executor::get_by_sandbox_id),
        )
        .route(
            "/executors/by-image-ref",
            get(handlers::executor::get_by_image_ref),
        )
        .route(
            "/executors",
            get(handlers::executor::list).post(handlers::executor::create),
        )
        .route(
            "/executors/{id}/scheduling",
            axum::routing::patch(handlers::executor::update_scheduling),
        )
}
