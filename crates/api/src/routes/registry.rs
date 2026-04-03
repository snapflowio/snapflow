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
        handlers::registry::create,
        handlers::registry::list,
        handlers::registry::get_push_access,
        handlers::registry::get_by_id,
        handlers::registry::update,
        handlers::registry::delete,
        handlers::registry::set_default,
    ),
    components(schemas(
        schemas::registry::CreateRegistryDto,
        schemas::registry::UpdateRegistryDto,
        schemas::registry::RegistryDto,
        schemas::registry::RegistryPushAccessDto,
        snapflow_models::RegistryType,
    ))
)]
pub struct Api;

pub fn router() -> Router<AppState> {
    Router::default()
        .route(
            "/registry",
            post(handlers::registry::create).get(handlers::registry::list),
        )
        .route(
            "/registry/registry-push-access",
            get(handlers::registry::get_push_access),
        )
        .route(
            "/registry/{id}",
            get(handlers::registry::get_by_id)
                .patch(handlers::registry::update)
                .delete(handlers::registry::delete),
        )
        .route(
            "/registry/{id}/set-default",
            post(handlers::registry::set_default),
        )
}
