// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Router;
use axum::routing::post;
use utoipa::OpenApi;

use crate::handlers;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(paths(handlers::oauth::authorize, handlers::oauth::exchange_token,))]
pub struct Api;

pub fn protected_router() -> Router<AppState> {
    Router::default().route("/oauth/authorize", post(handlers::oauth::authorize))
}

pub fn public_router() -> Router<AppState> {
    Router::default().route("/oauth/token", post(handlers::oauth::exchange_token))
}
