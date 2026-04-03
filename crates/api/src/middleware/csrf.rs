// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::State;
use axum::http::{Method, Request};
use axum::middleware::Next;
use axum::response::Response;

use crate::state::AppState;
use snapflow_errors::AppError;

pub async fn check_origin(
    State(state): State<AppState>,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, AppError> {
    let method = request.method().clone();
    let headers = request.headers();

    if matches!(method, Method::GET | Method::HEAD | Method::OPTIONS) {
        return Ok(next.run(request).await);
    }

    let has_cookies = headers.get("cookie").is_some();
    if !has_cookies {
        return Ok(next.run(request).await);
    }

    let origin = headers
        .get("origin")
        .or_else(|| headers.get("referer"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if origin.is_empty() {
        return Err(AppError::Forbidden("missing origin header".into()));
    }

    let trusted = [
        extract_origin(&state.infra.config.api_url),
        extract_origin(&state.infra.config.website_url),
    ];

    let request_origin = extract_origin(origin);

    if trusted.contains(&request_origin) {
        return Ok(next.run(request).await);
    }

    Err(AppError::Forbidden("untrusted origin".into()))
}

fn extract_origin(url: &str) -> String {
    url::Url::parse(url)
        .ok()
        .map(|u| format!("{}://{}", u.scheme(), u.host_str().unwrap_or("")))
        .unwrap_or_default()
}
