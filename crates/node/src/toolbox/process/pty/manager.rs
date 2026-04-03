// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::ws::CloseFrame;
use dashmap::DashMap;
use futures_util::SinkExt;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use super::session::start_session;
use super::types::{PtySession, PtySessionInfo};

pub struct PtyManager {
    sessions: DashMap<String, Arc<PtySession>>,
    idle_cancels: DashMap<String, CancellationToken>,
    work_dir: String,
}

impl PtyManager {
    pub fn new(work_dir: String) -> Self {
        Self {
            sessions: DashMap::default(),
            idle_cancels: DashMap::default(),
            work_dir,
        }
    }

    /// Store an idle-cleanup cancellation token for a session.
    pub fn set_idle_cancel(&self, id: &str, token: CancellationToken) {
        self.idle_cancels.insert(id.to_string(), token);
    }

    /// Cancel any pending idle cleanup for a session (called when a new client connects).
    pub fn cancel_idle_cleanup(&self, id: &str) {
        if let Some((_, token)) = self.idle_cancels.remove(id) {
            token.cancel();
        }
    }

    pub fn add(&self, session: Arc<PtySession>) {
        let info = session.info.lock();
        let id = info.id.clone();
        drop(info);
        self.sessions.insert(id, session);
    }

    pub fn get(&self, id: &str) -> Option<Arc<PtySession>> {
        self.sessions.get(id).map(|r| Arc::clone(r.value()))
    }

    pub fn remove(&self, id: &str) -> Option<Arc<PtySession>> {
        self.idle_cancels.remove(id);
        self.sessions.remove(id).map(|(_, v)| v)
    }

    pub fn list(&self) -> Vec<PtySessionInfo> {
        self.sessions
            .iter()
            .map(|entry| entry.value().info.lock().clone())
            .collect()
    }

    pub fn create_session(
        self: &Arc<Self>,
        id: String,
        cwd: Option<String>,
        envs: Option<HashMap<String, String>>,
        cols: Option<u16>,
        rows: Option<u16>,
        lazy_start: bool,
    ) -> Result<Arc<PtySession>, String> {
        if self.sessions.contains_key(&id) {
            return Err(format!("PTY session with ID '{}' already exists", id));
        }

        let resolved_cwd = cwd.unwrap_or_else(|| self.work_dir.clone());
        let mut resolved_envs = envs.unwrap_or_default();
        resolved_envs
            .entry("TERM".to_string())
            .or_insert_with(|| "xterm-256color".to_string());

        let resolved_cols = cols.unwrap_or(80);
        let resolved_rows = rows.unwrap_or(24);

        if resolved_cols > 1000 || resolved_rows > 1000 {
            return Err("cols and rows must be less than 1000".to_string());
        }

        let (input_tx, input_rx) = mpsc::channel::<Vec<u8>>(1024);

        let session = Arc::new(PtySession {
            info: parking_lot::Mutex::new(PtySessionInfo {
                id: id.clone(),
                cwd: resolved_cwd,
                envs: resolved_envs,
                cols: resolved_cols,
                rows: resolved_rows,
                created_at: chrono::Utc::now().to_rfc3339(),
                active: false,
                lazy_start,
            }),
            master: parking_lot::Mutex::new(None),
            child: parking_lot::Mutex::new(None),
            clients: DashMap::default(),
            input_tx,
            input_rx: parking_lot::Mutex::new(Some(input_rx)),
            cancel: CancellationToken::default(),
            started: tokio::sync::Notify::default(),
            scrollback: parking_lot::Mutex::new(super::types::ScrollbackBuffer::default()),
        });

        self.add(Arc::clone(&session));

        if !lazy_start {
            if let Err(e) = start_session(&session) {
                self.remove(&id);
                return Err(e);
            }
            let manager = Arc::clone(self);
            let session_clone = Arc::clone(&session);
            tokio::spawn(async move {
                reap_process(manager, session_clone).await;
            });
        }

        Ok(session)
    }

    pub fn verify_session_ready(self: &Arc<Self>, id: &str) -> Result<Arc<PtySession>, String> {
        let session = self
            .get(id)
            .ok_or_else(|| format!("PTY session {} not found", id))?;

        let info = session.info.lock().clone();

        if !info.active {
            if info.lazy_start {
                start_session(&session)
                    .map_err(|e| format!("failed to start PTY session: {}", e))?;
                let manager = Arc::clone(self);
                let session_clone = Arc::clone(&session);
                tokio::spawn(async move {
                    reap_process(manager, session_clone).await;
                });
            } else {
                return Err(format!(
                    "PTY session '{}' has terminated and is no longer available",
                    id
                ));
            }
        }

        Ok(session)
    }

    pub fn verify_session_for_resize(&self, id: &str) -> Result<Arc<PtySession>, String> {
        let session = self
            .get(id)
            .ok_or_else(|| format!("PTY session {} not found", id))?;

        let info = session.info.lock().clone();

        if !info.active && !info.lazy_start {
            return Err(format!(
                "PTY session '{}' has terminated and cannot be resized",
                id
            ));
        }

        Ok(session)
    }
}

async fn reap_process(manager: Arc<PtyManager>, session: Arc<PtySession>) {
    let mut child_opt = session.child.lock().take();
    let Some(ref mut child) = child_opt else {
        return;
    };

    // portable-pty Child::wait() is blocking, so run on blocking thread
    let exit_code = match tokio::task::block_in_place(|| child.wait()) {
        Ok(s) => s.exit_code() as i32,
        Err(_) => 1,
    };

    let session_id = {
        let mut info = session.info.lock();
        info.active = false;
        info.id.clone()
    };

    close_clients_with_exit_code(&session, exit_code).await;
    manager.remove(&session_id);

    tracing::debug!(
        session_id = %session_id,
        exit_code = exit_code,
        "PTY session process exited and cleaned up"
    );
}

async fn close_clients_with_exit_code(session: &PtySession, exit_code: i32) {
    let exit_reason = match exit_code {
        0 => None,
        130 => Some("Ctrl+C"),
        137 => Some("SIGKILL"),
        143 => Some("SIGTERM"),
        c if c > 128 => Some("signal"),
        _ => Some("non-zero exit"),
    };

    let close_data = serde_json::json!({
        "exitCode": exit_code,
        "exitReason": exit_reason,
    });

    let ws_close_code = if exit_code == 0 { 1000 } else { 1011 };

    let items: Vec<_> = session
        .clients
        .iter()
        .map(|entry| (entry.key().clone(), Arc::clone(entry.value())))
        .collect();

    for (id, client) in items {
        let frame = CloseFrame {
            code: ws_close_code,
            reason: close_data.to_string().into(),
        };
        let mut tx = client.ws_tx.lock().await;
        let _ = tx
            .send(axum::extract::ws::Message::Close(Some(frame)))
            .await;
        drop(tx);
        client.close();
        session.clients.remove(&id);
    }
}
