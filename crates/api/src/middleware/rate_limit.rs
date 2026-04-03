// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::State;
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;
use common_rs::middleware::rate_limit::{extract_client_ip, limit_by_key};

pub use common_rs::middleware::rate_limit::{
    KeyedRateLimiter, create_limiter, create_limiter_with_period,
};

use crate::state::AppState;

pub fn create_auth_limiter(burst: u32) -> KeyedRateLimiter {
    create_limiter_with_period(burst, std::time::Duration::from_secs(10))
}

pub async fn limit_auth_by_ip(
    State(state): State<AppState>,
    request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let key = extract_client_ip(&request);
    limit_by_key(
        &state.auth_rate_limiter,
        &key,
        "too many authentication attempts, please try again later",
        request,
        next,
    )
    .await
}

pub async fn limit_by_ip(
    State(state): State<AppState>,
    request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let key = extract_client_ip(&request);
    limit_by_key(
        &state.rate_limiter,
        &key,
        "too many requests, please try again later",
        request,
        next,
    )
    .await
}
