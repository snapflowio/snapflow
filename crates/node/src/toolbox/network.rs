// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use axum::Json;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use utoipa::ToSchema;

use crate::network::types::NetworkEvent;
use crate::toolbox::AppState;

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NetworkEventsResponse {
    pub events: Vec<NetworkEvent>,
}

#[utoipa::path(
    get,
    path = "/network/events",
    tag = "network",
    operation_id = "getNetworkEvents",
    responses(
        (status = 200, body = NetworkEventsResponse),
    )
)]
pub async fn get_events(State(state): State<Arc<AppState>>) -> Json<NetworkEventsResponse> {
    let events = state
        .network_broadcast
        .as_ref()
        .map(|b| b.recent_events())
        .unwrap_or_default();

    Json(NetworkEventsResponse { events })
}

#[utoipa::path(
    get,
    path = "/network/stream",
    tag = "network",
    operation_id = "streamNetworkEvents",
    responses(
        (status = 101, description = "WebSocket upgrade"),
        (status = 503, description = "Network interception not enabled"),
    )
)]
pub async fn stream_events(
    State(state): State<Arc<AppState>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let Some(ref broadcast) = state.network_broadcast else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "network interception not enabled",
        )
            .into_response();
    };

    let rx = broadcast.subscribe();
    ws.on_upgrade(move |socket| handle_stream(socket, rx))
        .into_response()
}

async fn handle_stream(socket: WebSocket, mut rx: tokio::sync::broadcast::Receiver<NetworkEvent>) {
    let (mut ws_tx, mut ws_rx) = socket.split();

    let send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    let Ok(json) = serde_json::to_string(&event) else {
                        continue;
                    };
                    if ws_tx.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    tracing::debug!(
                        skipped = n,
                        "network stream subscriber lagged, skipping events"
                    );
                    continue;
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            if matches!(msg, Message::Close(_)) {
                break;
            }
        }
    });

    tokio::select! {
        _ = send_task => {}
        _ = recv_task => {}
    }
}
