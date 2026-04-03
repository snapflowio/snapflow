// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::sync::Arc;

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::Notify;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;
use utoipa::ToSchema;

use super::ws_client::WsClient;

const SCROLLBACK_CAPACITY: usize = 128 * 1024;

pub struct ScrollbackBuffer {
    buf: Vec<u8>,
}

impl Default for ScrollbackBuffer {
    fn default() -> Self {
        Self {
            buf: Vec::with_capacity(SCROLLBACK_CAPACITY),
        }
    }
}

impl ScrollbackBuffer {
    pub fn push(&mut self, data: &[u8]) {
        if self.buf.len() + data.len() > SCROLLBACK_CAPACITY {
            let overflow = (self.buf.len() + data.len()) - SCROLLBACK_CAPACITY;
            self.buf.drain(..overflow);
        }

        self.buf.extend_from_slice(data);
    }

    pub fn contents(&self) -> &[u8] {
        &self.buf
    }
}

pub struct PtySession {
    pub info: parking_lot::Mutex<PtySessionInfo>,
    pub master: parking_lot::Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>,
    pub child: parking_lot::Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>,
    pub clients: DashMap<String, Arc<WsClient>>,
    pub input_tx: mpsc::Sender<Vec<u8>>,
    pub input_rx: parking_lot::Mutex<Option<mpsc::Receiver<Vec<u8>>>>,
    pub cancel: CancellationToken,
    pub started: Notify,
    pub scrollback: parking_lot::Mutex<ScrollbackBuffer>,
}

#[derive(Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionInfo {
    pub id: String,
    pub cwd: String,
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub envs: HashMap<String, String>,
    pub cols: u16,
    pub rows: u16,
    pub created_at: String,
    pub active: bool,
    pub lazy_start: bool,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PtyCreateRequest {
    pub id: String,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub envs: Option<HashMap<String, String>>,
    #[serde(default)]
    pub cols: Option<u16>,
    #[serde(default)]
    pub rows: Option<u16>,
    #[serde(default)]
    pub lazy_start: bool,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PtyCreateResponse {
    pub session_id: String,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PtyListResponse {
    pub sessions: Vec<PtySessionInfo>,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PtyResizeRequest {
    pub cols: u16,
    pub rows: u16,
}
