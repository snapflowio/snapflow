// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod assets;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::body::Body;
use axum::extract::ws::Message;
use axum::extract::ws::WebSocket;
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::http::{StatusCode, header};
use axum::response::IntoResponse;
use axum::routing::get;
use futures_util::{SinkExt, StreamExt};
use tokio_util::sync::CancellationToken;

use crate::toolbox::process::pty::PtyManager;
use crate::toolbox::process::pty::session::kill_session;
use crate::toolbox::process::pty::websocket::attach_websocket;

use self::assets::StaticFiles;

/// How long a session stays alive after the last client disconnects.
const IDLE_GRACE_PERIOD: Duration = Duration::from_secs(300);

pub fn router(pty_manager: Arc<PtyManager>) -> Router {
    Router::default()
        .route("/ws", get(ws_handler))
        .fallback(get(serve_static))
        .with_state(pty_manager)
}

async fn serve_static(uri: axum::http::Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    match StaticFiles::get(path) {
        Some(file) => {
            let mime = mime_guess::from_path(path)
                .first_or_octet_stream()
                .to_string();
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, mime)],
                Body::from(file.data.to_vec()),
            )
                .into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn ws_handler(
    State(pty_manager): State<Arc<PtyManager>>,
    Query(params): Query<HashMap<String, String>>,
    ws: WebSocketUpgrade,
) -> axum::response::Response {
    ws.max_message_size(1024 * 1024)
        .on_upgrade(move |socket| handle_ws(socket, pty_manager, params))
}

async fn handle_ws(
    socket: WebSocket,
    pty_manager: Arc<PtyManager>,
    params: HashMap<String, String>,
) {
    let session_id = match params.get("sessionId").filter(|s| !s.is_empty()) {
        Some(id) => id.clone(),
        None => format!("web-terminal-{}", uuid::Uuid::new_v4()),
    };

    let session = match get_or_create_session(&pty_manager, &session_id) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(error = %e, session_id = %session_id, "failed to start PTY session");
            send_error(socket, &e).await;
            return;
        }
    };

    tracing::info!(session_id = %session_id, "web terminal connected to PTY session");

    attach_websocket(Arc::clone(&session), socket).await;

    if session.clients.is_empty() {
        schedule_idle_cleanup(&pty_manager, &session, &session_id);
    }
}

fn schedule_idle_cleanup(
    pty_manager: &Arc<PtyManager>,
    session: &Arc<crate::toolbox::process::pty::types::PtySession>,
    session_id: &str,
) {
    let cancel = CancellationToken::default();
    pty_manager.set_idle_cancel(session_id, cancel.clone());

    let manager = Arc::clone(pty_manager);
    let session = Arc::clone(session);
    let sid = session_id.to_string();

    tokio::spawn(async move {
        tokio::select! {
            _ = cancel.cancelled() => {}
            _ = tokio::time::sleep(IDLE_GRACE_PERIOD) => {
                if session.clients.is_empty() {
                    kill_session(&session);
                    manager.remove(&sid);
                    tracing::debug!(session_id = %sid, "session cleaned up after idle grace period");
                }
            }
        }
    });

    tracing::debug!(
        session_id = %session_id,
        grace_secs = IDLE_GRACE_PERIOD.as_secs(),
        "all clients disconnected, cleanup scheduled"
    );
}

fn get_or_create_session(
    pty_manager: &Arc<PtyManager>,
    session_id: &str,
) -> Result<Arc<crate::toolbox::process::pty::types::PtySession>, String> {
    if pty_manager.get(session_id).is_some() {
        pty_manager.cancel_idle_cleanup(session_id);
        return pty_manager.verify_session_ready(session_id);
    }

    pty_manager.create_session(session_id.to_owned(), None, None, None, None, false)?;
    pty_manager
        .get(session_id)
        .ok_or_else(|| "session was created but not found".to_owned())
}

async fn send_error(socket: WebSocket, error: &str) {
    let (mut tx, _rx) = socket.split();
    let msg = serde_json::json!({
        "type": "control",
        "status": "error",
        "error": error,
    });
    if let Ok(json) = serde_json::to_string(&msg) {
        let _ = tx.send(Message::Text(json.into())).await;
    }
    let _ = tx.close().await;
}
