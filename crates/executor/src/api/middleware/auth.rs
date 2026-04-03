// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};

use crate::api::AppState;
use crate::api::errors::AppError;
use crate::constants::{AUTHORIZATION_HEADER, BEARER_AUTH_PREFIX, SNAPFLOW_AUTHORIZATION_HEADER};

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = request
        .headers()
        .get(SNAPFLOW_AUTHORIZATION_HEADER)
        .or_else(|| request.headers().get(AUTHORIZATION_HEADER))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if auth_header.is_empty() {
        return Err(AppError::unauthorized("authorization header required"));
    }

    if let Some((auth_prefix, auth_token)) = auth_header.split_once(' ') {
        if auth_prefix != BEARER_AUTH_PREFIX {
            return Err(AppError::unauthorized(
                "invalid authorization header format",
            ));
        }

        if auth_token != state.config.api_token {
            return Err(AppError::unauthorized("invalid token"));
        }
    }

    Ok(next.run(request).await)
}
