// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;

use super::session::resize_session;
use super::types::PtySession;
use super::ws_client::WsClient;

#[derive(Deserialize)]
struct ResizeMsg {
    #[serde(rename = "type")]
    msg_type: Option<String>,
    rows: u16,
    cols: u16,
}

pub async fn attach_websocket(session: Arc<PtySession>, socket: WebSocket) {
    let (ws_tx, mut ws_rx) = socket.split();
    let client_id = uuid::Uuid::new_v4().to_string();
    let (client, send_rx) = WsClient::new(ws_tx);
    let client = Arc::new(client);

    session
        .clients
        .insert(client_id.clone(), Arc::clone(&client));

    let client_count = session.clients.len();
    tracing::info!(
        client_id = %client_id,
        session_id = %session.info.lock().id,
        client_count = client_count,
        "Client attached to PTY session"
    );

    let writer_client = Arc::clone(&client);
    let writer_cancel = session.cancel.clone();
    let writer_handle = tokio::spawn(async move {
        client_writer(writer_client, send_rx, writer_cancel).await;
    });

    let success_msg = serde_json::json!({
        "type": "control",
        "status": "connected",
    });
    let replay = {
        let sb = session.scrollback.lock();
        let c = sb.contents();
        if c.is_empty() { None } else { Some(c.to_vec()) }
    };

    {
        let mut tx = client.ws_tx.lock().await;
        if let Ok(json) = serde_json::to_string(&success_msg) {
            let _ = tx.send(Message::Text(json.into())).await;
        }
        if let Some(data) = replay {
            let _ = tx.send(Message::Binary(data.into())).await;
        }
    }

    client_reader(&session, &client, &mut ws_rx).await;

    session.clients.remove(&client_id);
    client.close();
    writer_handle.abort();

    let remaining = session.clients.len();
    tracing::info!(
        client_id = %client_id,
        session_id = %session.info.lock().id,
        remaining_clients = remaining,
        "Client detached from PTY session"
    );
}

async fn client_writer(
    client: Arc<WsClient>,
    mut send_rx: mpsc::Receiver<Vec<u8>>,
    cancel: tokio_util::sync::CancellationToken,
) {
    loop {
        tokio::select! {
            _ = cancel.cancelled() => return,
            _ = client.close_notify.notified() => return,
            data = send_rx.recv() => {
                let Some(data) = data else { return };
                let mut tx = client.ws_tx.lock().await;
                if tx.send(Message::Binary(data.into())).await.is_err() {
                    return;
                }
            }
        }
    }
}

async fn client_reader(
    session: &PtySession,
    _client: &WsClient,
    ws_rx: &mut futures_util::stream::SplitStream<WebSocket>,
) {
    while let Some(msg) = ws_rx.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(_) => return,
        };

        match msg {
            Message::Text(text) => {
                // Check for resize control messages before forwarding to PTY
                if let Ok(resize) = serde_json::from_str::<ResizeMsg>(&text) {
                    if resize.msg_type.as_deref() == Some("resize")
                        || (resize.rows > 0 && resize.cols > 0 && resize.msg_type.is_none())
                    {
                        let _ = resize_session(session, resize.cols, resize.rows);
                        continue;
                    }
                }

                if session
                    .input_tx
                    .send(text.as_bytes().to_vec())
                    .await
                    .is_err()
                {
                    return;
                }
            }
            Message::Binary(data) => {
                if session.input_tx.send(data.to_vec()).await.is_err() {
                    return;
                }
            }
            Message::Close(_) => return,
            _ => {}
        }
    }
}
