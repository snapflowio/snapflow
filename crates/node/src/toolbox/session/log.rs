// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::*;
use snapflow_errors::AppError;
use crate::toolbox::AppState;
use axum::{
    extract::{FromRequestParts, Path, Query, State, WebSocketUpgrade, ws::WebSocket},
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

#[utoipa::path(
    get,
    path = "/process/session/{sessionId}/command/{commandId}/logs",
    tag = "process",
    operation_id = "getCommandLogs",
    params(
        ("sessionId" = String, Path,),
        ("commandId" = String, Path,),
        FollowQuery,
    ),
    responses(
        (status = 200, content_type = "text/plain"),
    )
)]
pub async fn get_command_logs(
    State(state): State<Arc<AppState>>,
    Path((session_id, cmd_id)): Path<(String, String)>,
    Query(q): Query<FollowQuery>,
    req: axum::http::Request<axum::body::Body>,
) -> Result<axum::response::Response, AppError> {
    let sc = &state.sessions;

    {
        let session = sc
            .sessions
            .get(&session_id)
            .ok_or_else(|| AppError::not_found("session not found"))?;

        if !session.commands.contains_key(&cmd_id) {
            return Err(AppError::not_found("command not found"));
        }
    }

    let (log_path, _) = SessionInner::log_file_path(&sc.config_dir, &session_id, &cmd_id);

    if !log_path.exists() {
        return Err(AppError::not_found("log file not found"));
    }

    let follow = q.follow.as_deref() == Some("true");

    if follow {
        let is_ws = req
            .headers()
            .get("upgrade")
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v.eq_ignore_ascii_case("websocket"));

        if is_ws {
            let log_path = log_path.clone();
            let (mut parts, _body) = req.into_parts();
            let ws = WebSocketUpgrade::from_request_parts(&mut parts, &())
                .await
                .map_err(|e| AppError::bad_request(e.to_string()))?;
            return Ok(ws.on_upgrade(move |socket| async move {
                let _ = stream_log_ws(socket, log_path).await;
            }));
        }
    }

    let content = tokio::fs::read_to_string(&log_path)
        .await
        .map_err(AppError::from)?;
    Ok(content.into_response())
}

async fn stream_log_ws(socket: WebSocket, log_path: PathBuf) -> anyhow::Result<()> {
    let (mut sender, mut receiver) = socket.split();

    let read_task = tokio::spawn(async move {
        let mut file = match tokio::fs::File::open(&log_path).await {
            Ok(f) => f,
            Err(_) => return,
        };
        let mut offset = 0u64;
        let mut buf = vec![0u8; 8192];

        loop {
            match file.metadata().await {
                Ok(meta) => {
                    let len = meta.len();
                    if len > offset {
                        if file.seek(std::io::SeekFrom::Start(offset)).await.is_err() {
                            break;
                        }

                        loop {
                            match file.read(&mut buf).await {
                                Ok(0) => break,
                                Ok(n) => {
                                    offset += n as u64;
                                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                                    if sender
                                        .send(axum::extract::ws::Message::Text(text.into()))
                                        .await
                                        .is_err()
                                    {
                                        return;
                                    }
                                }
                                Err(_) => break,
                            }
                        }
                    }
                }
                Err(_) => break,
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
    });

    while let Some(Ok(_)) = receiver.next().await {}
    read_task.abort();

    Ok(())
}
