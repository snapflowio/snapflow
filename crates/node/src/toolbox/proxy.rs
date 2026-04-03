// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::{
    body::Body,
    http::{Request, StatusCode, Uri, header},
    response::{IntoResponse, Response},
};

pub async fn proxy_handler(mut req: Request<Body>) -> Result<Response, Response> {
    let raw_path = req.uri().path();
    let trimmed = raw_path
        .strip_prefix("/proxy/")
        .or_else(|| raw_path.strip_prefix("/"))
        .unwrap_or(raw_path);

    let (port, path) = match trimmed.split_once('/') {
        Some((p, rest)) => (p, format!("/{rest}")),
        None => (trimmed, "/".to_string()),
    };

    if port.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "target port is required").into_response());
    }

    let query = req
        .uri()
        .query()
        .map(|q| format!("?{q}"))
        .unwrap_or_default();

    let target_host = format!("127.0.0.1:{port}");
    let target_path_query = format!("{path}{query}");

    req.headers_mut().remove("x-forwarded-for");
    req.headers_mut().remove("x-forwarded-proto");
    req.headers_mut().remove("x-forwarded-host");
    let host_value = target_host
        .parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, "invalid host header").into_response())?;
    req.headers_mut().insert(header::HOST, host_value);

    *req.uri_mut() = target_path_query
        .parse::<Uri>()
        .map_err(|_| (StatusCode::BAD_REQUEST, "invalid target URL").into_response())?;

    Ok(common_rs::proxy::forward(req, &target_host).await)
}
