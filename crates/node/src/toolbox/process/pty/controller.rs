// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use axum::Json;
use axum::extract::ws::WebSocket;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};

use snapflow_errors::AppError;
use crate::toolbox::AppState;

use super::session::resize_session;
use super::types::{PtyCreateRequest, PtyCreateResponse, PtyListResponse, PtyResizeRequest};
use super::websocket::attach_websocket;

#[utoipa::path(
    post,
    path = "/process/pty",
    tag = "process",
    operation_id = "createPtySession",
    request_body = PtyCreateRequest,
    responses(
        (status = 201, body = PtyCreateResponse),
    )
)]
pub async fn create_pty_session(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PtyCreateRequest>,
) -> Result<impl IntoResponse, AppError> {
    if req.id.is_empty() {
        return Err(AppError::bad_request("session ID is required"));
    }

    if let Some(cols) = req.cols
        && cols > 1000
    {
        return Err(AppError::bad_request(
            "invalid value for cols - must be less than 1000",
        ));
    }
    if let Some(rows) = req.rows
        && rows > 1000
    {
        return Err(AppError::bad_request(
            "invalid value for rows - must be less than 1000",
        ));
    }

    let _session = state
        .pty_manager
        .create_session(
            req.id.clone(),
            req.cwd,
            req.envs,
            req.cols,
            req.rows,
            req.lazy_start,
        )
        .map_err(AppError::internal)?;

    Ok((
        StatusCode::CREATED,
        Json(PtyCreateResponse { session_id: req.id }),
    ))
}

#[utoipa::path(
    get,
    path = "/process/pty",
    tag = "process",
    operation_id = "listPtySessions",
    responses(
        (status = 200, body = PtyListResponse),
    )
)]
pub async fn list_pty_sessions(State(state): State<Arc<AppState>>) -> Json<PtyListResponse> {
    Json(PtyListResponse {
        sessions: state.pty_manager.list(),
    })
}

#[utoipa::path(
    get,
    path = "/process/pty/{sessionId}",
    tag = "process",
    operation_id = "getPtySession",
    params(
        ("sessionId" = String, Path,),
    ),
    responses(
        (status = 200),
    )
)]
pub async fn get_pty_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let session = state
        .pty_manager
        .get(&session_id)
        .ok_or_else(|| AppError::not_found("PTY session not found"))?;

    let info = session.info.lock().clone();
    Ok(Json(info))
}

#[utoipa::path(
    delete,
    path = "/process/pty/{sessionId}",
    tag = "process",
    operation_id = "deletePtySession",
    params(
        ("sessionId" = String, Path,),
    ),
    responses(
        (status = 200),
    )
)]
pub async fn delete_pty_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let session = state
        .pty_manager
        .remove(&session_id)
        .ok_or_else(|| AppError::not_found("PTY session not found"))?;

    super::session::kill_session(&session);

    tracing::debug!(session_id = %session_id, "Deleted PTY session");

    Ok(Json(
        serde_json::json!({ "message": "PTY session deleted" }),
    ))
}

#[utoipa::path(
    post,
    path = "/process/pty/{sessionId}/resize",
    tag = "process",
    operation_id = "resizePtySession",
    params(
        ("sessionId" = String, Path,),
    ),
    request_body = PtyResizeRequest,
    responses(
        (status = 200),
    )
)]
pub async fn resize_pty_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(req): Json<PtyResizeRequest>,
) -> Result<impl IntoResponse, AppError> {
    if req.cols > 1000 || req.rows > 1000 {
        return Err(AppError::bad_request(
            "cols and rows must be less than 1000",
        ));
    }

    let session = state
        .pty_manager
        .verify_session_for_resize(&session_id)
        .map_err(AppError::not_found)?;

    resize_session(&session, req.cols, req.rows).map_err(AppError::internal)?;

    tracing::debug!(
        session_id = %session_id,
        cols = req.cols,
        rows = req.rows,
        "Resized PTY session"
    );

    let info = session.info.lock().clone();
    Ok(Json(info))
}

pub async fn connect_pty_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    ws: axum::extract::WebSocketUpgrade,
) -> Result<axum::response::Response, AppError> {
    let manager = Arc::clone(&state.pty_manager);

    Ok(ws.on_upgrade(move |socket: WebSocket| async move {
        match manager.verify_session_ready(&session_id) {
            Ok(session) => {
                attach_websocket(session, socket).await;
            }
            Err(e) => {
                tracing::debug!(error = %e, "Failed to connect to PTY session");
                let error_msg = serde_json::json!({
                    "type": "control",
                    "status": "error",
                    "error": format!("Failed to connect to PTY session: {}", e),
                });
                let (mut tx, _rx) = socket.split();
                if let Ok(json) = serde_json::to_string(&error_msg) {
                    let _ = tx.send(axum::extract::ws::Message::Text(json.into())).await;
                }
                let _ = tx.close().await;
            }
        }
    }))
}
