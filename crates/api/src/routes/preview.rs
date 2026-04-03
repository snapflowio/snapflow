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
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(paths(
    handlers::preview::has_sandbox_access,
    handlers::preview::is_valid_auth_token,
    handlers::preview::is_sandbox_public,
))]
pub struct Api;

pub fn public_router() -> Router<AppState> {
    Router::default()
        .route(
            "/preview/{sandboxId}/validate/{authToken}",
            get(handlers::preview::is_valid_auth_token),
        )
        .route(
            "/preview/{sandboxId}/public",
            get(handlers::preview::is_sandbox_public),
        )
}

pub fn protected_router() -> Router<AppState> {
    Router::default().route(
        "/preview/{sandboxId}/access",
        get(handlers::preview::has_sandbox_access),
    )
}
