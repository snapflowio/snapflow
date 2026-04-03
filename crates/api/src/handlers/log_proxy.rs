// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::body::Body;
use axum::http::{HeaderValue, Response, StatusCode};
use futures_util::TryStreamExt;
use reqwest::header::AUTHORIZATION;

use crate::models::Executor;
use snapflow_errors::{AppError, Result};

pub async fn stream_build_logs(
    executor: &Executor,
    image_ref: &str,
    follow: bool,
) -> Result<Response<Body>> {
    let url = format!(
        "{}/images/logs?imageRef={}&follow={}",
        executor.api_url, image_ref, follow
    );

    let response = reqwest::Client::default()
        .get(&url)
        .header(AUTHORIZATION, format!("Bearer {}", executor.api_key))
        .header("Accept", "application/octet-stream")
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("failed to connect to executor: {e}")))?;

    let status = StatusCode::from_u16(response.status().as_u16())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

    let stream = response.bytes_stream().map_err(std::io::Error::other);

    let body = Body::from_stream(stream);

    let mut resp = Response::new(body);
    *resp.status_mut() = status;
    resp.headers_mut().insert(
        "content-type",
        HeaderValue::from_static("application/octet-stream"),
    );

    Ok(resp)
}
