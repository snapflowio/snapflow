// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::num::NonZeroU32;
use std::sync::Arc;

use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use governor::clock::DefaultClock;
use governor::state::keyed::DashMapStateStore;
use governor::{Quota, RateLimiter};

pub type KeyedRateLimiter = Arc<RateLimiter<String, DashMapStateStore<String>, DefaultClock>>;

pub fn create_limiter(burst: u32) -> KeyedRateLimiter {
    let burst = NonZeroU32::new(burst).expect("burst must be > 0");
    let quota = Quota::per_second(burst);
    Arc::new(RateLimiter::dashmap(quota))
}

pub fn create_limiter_with_period(burst: u32, period: std::time::Duration) -> KeyedRateLimiter {
    let burst = NonZeroU32::new(burst).expect("burst must be > 0");
    let quota = Quota::with_period(period)
        .expect("valid period")
        .allow_burst(burst);
    Arc::new(RateLimiter::dashmap(quota))
}

pub fn extract_client_ip(request: &Request<axum::body::Body>) -> String {
    request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map_or_else(
            || "unknown".into(),
            |s| s.split(',').next().unwrap_or(s).trim().to_string(),
        )
}

pub async fn limit_by_key(
    limiter: &KeyedRateLimiter,
    key: &str,
    message: &str,
    request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    match limiter.check_key(&key.to_string()) {
        Ok(_) => next.run(request).await,
        Err(_) => (StatusCode::TOO_MANY_REQUESTS, message.to_string()).into_response(),
    }
}
