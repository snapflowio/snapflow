// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tokio::sync::mpsc;

use crate::common::shell::get_shell;

use super::types::PtySession;

pub fn start_session(session: &Arc<PtySession>) -> Result<(), String> {
    let mut info = session.info.lock();

    if info.active && session.child.lock().is_some() {
        return Ok(());
    }

    if session.child.lock().is_some() {
        return Err("PTY session has already been used and cannot be restarted".to_string());
    }

    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: info.rows,
            cols: info.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("failed to open PTY: {}", e))?;

    let shell = get_shell();
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-i");
    cmd.arg("-l");
    cmd.cwd(&info.cwd);

    // Inherit current env, then overlay session-specific vars
    for (k, v) in &info.envs {
        cmd.env(k, v);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("failed to spawn PTY process: {}", e))?;

    drop(pair.slave);

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("failed to clone PTY reader: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("failed to take PTY writer: {}", e))?;

    *session.master.lock() = Some(pair.master);
    *session.child.lock() = Some(child);
    info.active = true;

    // Spawn PTY read loop using spawn_blocking since portable-pty provides sync Read
    {
        let cancel = session.cancel.clone();
        let session_weak = Arc::downgrade(session);
        tokio::task::spawn_blocking(move || {
            pty_read_loop(reader, session_weak, cancel);
        });
    }

    // Spawn input write loop
    let input_rx = session.input_rx.lock().take();
    if let Some(rx) = input_rx {
        let cancel = session.cancel.clone();
        tokio::task::spawn_blocking(move || {
            input_write_loop(writer, rx, cancel);
        });
    }

    session.started.notify_waiters();

    tracing::debug!(session_id = %info.id, "Started PTY session");

    Ok(())
}

pub fn resize_session(session: &PtySession, cols: u16, rows: u16) -> Result<(), String> {
    let mut info = session.info.lock();

    if !info.active {
        return Err("cannot resize inactive PTY session".to_string());
    }

    if cols > 1000 || rows > 1000 {
        return Err("cols and rows must be less than 1000".to_string());
    }

    let master_guard = session.master.lock();
    let master = master_guard.as_ref().ok_or("PTY master is not available")?;

    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("resize failed: {}", e))?;

    info.cols = cols;
    info.rows = rows;

    Ok(())
}

pub fn kill_session(session: &PtySession) {
    {
        let mut info = session.info.lock();
        if !info.active {
            return;
        }
        info.active = false;
    }

    session.cancel.cancel();

    {
        let mut master = session.master.lock();
        *master = None;
    }

    {
        let mut child = session.child.lock();
        if let Some(ref mut c) = *child {
            let _ = c.kill();
        }
    }
}

fn pty_read_loop(
    mut reader: Box<dyn std::io::Read + Send>,
    session: std::sync::Weak<PtySession>,
    cancel: tokio_util::sync::CancellationToken,
) {
    let mut buf = vec![0u8; 32 * 1024];

    loop {
        if cancel.is_cancelled() {
            return;
        }

        match std::io::Read::read(&mut reader, &mut buf) {
            Ok(0) => return,
            Ok(n) => {
                let data = buf[..n].to_vec();
                if let Some(session) = session.upgrade() {
                    broadcast(&session, data);
                } else {
                    return;
                }
            }
            Err(_) => return,
        }
    }
}

fn broadcast(session: &PtySession, data: Vec<u8>) {
    session.scrollback.lock().push(&data);

    let items: Vec<_> = session
        .clients
        .iter()
        .map(|entry| Arc::clone(entry.value()))
        .collect();

    for client in items {
        if client.send.try_send(data.clone()).is_err() {
            client.close();
        }
    }
}

fn input_write_loop(
    mut writer: Box<dyn std::io::Write + Send>,
    mut rx: mpsc::Receiver<Vec<u8>>,
    cancel: tokio_util::sync::CancellationToken,
) {
    loop {
        if cancel.is_cancelled() {
            return;
        }

        match rx.blocking_recv() {
            Some(data) => {
                if std::io::Write::write_all(&mut writer, &data).is_err() {
                    return;
                }
            }
            None => return,
        }
    }
}
