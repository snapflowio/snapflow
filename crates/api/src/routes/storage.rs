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
    paths(handlers::storage::get_push_access),
    components(schemas(schemas::storage::StorageAccessDto))
)]
pub struct Api;

pub fn router() -> Router<AppState> {
    Router::default().route(
        "/storage/push-access",
        get(handlers::storage::get_push_access),
    )
}
