// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::body::Body;
use axum::extract::{Path, Query, Request, State};
use axum::http::header;
use axum::response::Response;
use futures_util::StreamExt;
use regex::Regex;
use serde::Deserialize;
use std::sync::{Arc, LazyLock};
use tokio_tungstenite::connect_async;
use tracing::error;

use crate::api::errors::AppError;

use super::super::AppState;

static WS_LOG_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^/?process/session/.+/command/.+/logs$").expect("valid regex"));

#[derive(Deserialize)]
pub struct ProxyQuery {
    pub follow: Option<String>,
}

pub async fn proxy_request(
    State(state): State<Arc<AppState>>,
    Path((sandbox_id, path)): Path<(String, String)>,
    Query(query): Query<ProxyQuery>,
    mut request: Request,
) -> Result<Response, AppError> {
    let ws_log_regex = &*WS_LOG_REGEX;

    if ws_log_regex.is_match(&path) && query.follow.as_deref() == Some("true") {
        return proxy_command_logs_stream(&state, &sandbox_id, &path, &query).await;
    }

    let container_inspect = state
        .docker
        .container_inspect(&sandbox_id)
        .await
        .map_err(|e| AppError::not_found(format!("sandbox container not found: {}", e)))?;

    let container_ip = state
        .docker
        .get_container_ip(&container_inspect)
        .ok_or_else(|| AppError::not_found("sandbox does not have an IP address"))?;

    let normalized_path = if path.starts_with('/') {
        path.clone()
    } else {
        format!("/{}", path)
    };

    let query_string = request
        .uri()
        .query()
        .map(|q| format!("?{}", q))
        .unwrap_or_default();

    let target_host = format!("{}:8082", container_ip);
    let target_path_query = format!("{}{}", normalized_path, query_string);

    *request.uri_mut() = target_path_query
        .parse()
        .map_err(|_| AppError::bad_request("invalid target URL"))?;

    let host_value = target_host
        .parse()
        .map_err(|_| AppError::bad_request("invalid host header value"))?;
    request.headers_mut().insert(header::HOST, host_value);

    Ok(common_rs::proxy::forward(request, &target_host).await)
}

async fn proxy_command_logs_stream(
    state: &Arc<AppState>,
    sandbox_id: &str,
    path: &str,
    query: &ProxyQuery,
) -> Result<Response, AppError> {
    let container_inspect = state
        .docker
        .container_inspect(sandbox_id)
        .await
        .map_err(|e| AppError::not_found(format!("sandbox container not found: {}", e)))?;

    let container_ip = state
        .docker
        .get_container_ip(&container_inspect)
        .ok_or_else(|| AppError::not_found("sandbox does not have an IP address"))?;

    let normalized_path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };

    let ws_url = format!("ws://{}:8082{}", container_ip, normalized_path);
    let ws_url_with_query = if let Some(ref follow) = query.follow {
        format!("{}?follow={}", ws_url, follow)
    } else {
        ws_url
    };

    let (ws_stream, _) = connect_async(&ws_url_with_query)
        .await
        .map_err(|e| AppError::bad_request(format!("failed to connect to WebSocket: {}", e)))?;

    let (_, mut read) = ws_stream.split();

    let stream = async_stream::stream! {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(tungstenite::Message::Text(text)) => {
                    let bytes: &[u8] = text.as_ref();
                    yield Ok::<_, std::io::Error>(axum::body::Bytes::copy_from_slice(bytes));
                }
                Ok(tungstenite::Message::Binary(data)) => {
                    yield Ok::<_, std::io::Error>(data);
                }
                Ok(tungstenite::Message::Close(_)) => break,
                Err(e) => {
                    if !matches!(e, tungstenite::Error::ConnectionClosed | tungstenite::Error::AlreadyClosed) {
                        error!(error = %e, "Error reading WebSocket message");
                    }
                    break;
                }
                _ => {}
            }
        }
    };

    let body = Body::from_stream(stream);
    let response = Response::builder()
        .header("Content-Type", "application/octet-stream")
        .body(body)
        .map_err(|e| AppError::internal(format!("failed to build response: {}", e)))?;

    Ok(response)
}
