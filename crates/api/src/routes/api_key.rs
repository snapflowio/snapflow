// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Router;
use axum::routing::{get, post};
use utoipa::OpenApi;

use crate::handlers;
use crate::schemas;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::api_key::create,
        handlers::api_key::list,
        handlers::api_key::get_current,
        handlers::api_key::get_by_name,
        handlers::api_key::delete,
        handlers::api_key::delete_for_user,
    ),
    components(schemas(
        schemas::api_key::CreateApiKeyDto,
        schemas::api_key::ApiKeyCreatedDto,
        schemas::api_key::ApiKeyDto,
        snapflow_models::OrganizationResourcePermission,
    ))
)]
pub struct Api;

pub fn router() -> Router<AppState> {
    Router::default()
        .route(
            "/api-keys",
            post(handlers::api_key::create).get(handlers::api_key::list),
        )
        .route("/api-keys/current", get(handlers::api_key::get_current))
        .route(
            "/api-keys/{name}",
            get(handlers::api_key::get_by_name).delete(handlers::api_key::delete),
        )
        .route(
            "/api-keys/{user_id}/{name}",
            axum::routing::delete(handlers::api_key::delete_for_user),
        )
}
