// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Once;

use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use tokio::sync::Mutex;
use tokio::sync::mpsc;

pub struct WsClient {
    pub ws_tx: Mutex<SplitSink<WebSocket, Message>>,
    pub send: mpsc::Sender<Vec<u8>>,
    closed: Once,
    pub close_notify: tokio::sync::Notify,
}

impl WsClient {
    pub fn new(ws_tx: SplitSink<WebSocket, Message>) -> (Self, mpsc::Receiver<Vec<u8>>) {
        let (send, recv) = mpsc::channel::<Vec<u8>>(256);
        let client = Self {
            ws_tx: Mutex::new(ws_tx),
            send,
            closed: Once::new(),
            close_notify: tokio::sync::Notify::default(),
        };
        (client, recv)
    }

    pub fn close(&self) {
        self.closed.call_once(|| {
            self.close_notify.notify_waiters();
        });
    }
}
