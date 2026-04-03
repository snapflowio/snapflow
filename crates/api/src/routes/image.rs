// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Router;
use axum::routing::{get, patch, post};
use utoipa::OpenApi;

use crate::handlers;
use crate::schemas;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::image::create,
        handlers::image::can_cleanup_image,
        handlers::image::get_by_id,
        handlers::image::delete,
        handlers::image::list,
        handlers::image::set_general_status,
        handlers::image::get_build_logs,
        handlers::image::activate,
        handlers::image::deactivate,
    ),
    components(schemas(
        schemas::sandbox::ImageDto,
        schemas::sandbox::CreateImageDto,
        schemas::sandbox::SetImageGeneralStatusDto,
        schemas::sandbox::PaginatedImagesDto,
        schemas::sandbox::BuildInfoDto,
        schemas::sandbox::CreateBuildInfoDto,
    ))
)]
pub struct Api;

pub fn router() -> Router<AppState> {
    Router::default()
        .route(
            "/images/can-cleanup-image",
            get(handlers::image::can_cleanup_image),
        )
        .route(
            "/images",
            get(handlers::image::list).post(handlers::image::create),
        )
        .route(
            "/images/{id}",
            get(handlers::image::get_by_id).delete(handlers::image::delete),
        )
        .route(
            "/images/{id}/general",
            patch(handlers::image::set_general_status),
        )
        .route(
            "/images/{id}/build-logs",
            get(handlers::image::get_build_logs),
        )
        .route("/images/{id}/activate", post(handlers::image::activate))
        .route("/images/{id}/deactivate", post(handlers::image::deactivate))
}
