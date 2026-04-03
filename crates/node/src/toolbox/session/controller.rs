// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::*;
use crate::common::errors::AppError;
use crate::common::shell::get_shell;
use crate::toolbox::AppState;
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use dashmap::DashMap;
use dashmap::Entry;
use nix::sys::signal::{Signal, kill, killpg};
use nix::unistd::Pid;
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;
use tracing::warn;

const TERMINATION_GRACE_PERIOD: Duration = Duration::from_secs(5);
const TERMINATION_CHECK_INTERVAL: Duration = Duration::from_millis(100);

pub struct SessionController {
    pub sessions: DashMap<String, SessionInner>,
    pub config_dir: String,
    pub project_dir: String,
}

impl SessionController {
    pub fn new(config_dir: String, project_dir: String) -> Self {
        Self {
            sessions: DashMap::default(),
            config_dir,
            project_dir,
        }
    }

    pub async fn cleanup(&self) {
        for entry in self.sessions.iter() {
            entry.value().cancel.cancel();
        }
        for mut entry in self.sessions.iter_mut() {
            terminate_session(&mut entry.value_mut()._child).await;
        }
        self.sessions.clear();
    }

    pub fn get_command_dto(&self, session_id: &str, entry: &CommandEntry) -> CommandDto {
        let exit_code = entry.exit_code.or_else(|| {
            let (_, exit_path) =
                SessionInner::log_file_path(&self.config_dir, session_id, &entry.id);
            std::fs::read_to_string(&exit_path)
                .ok()
                .and_then(|s| s.trim().parse().ok())
        });
        CommandDto {
            id: entry.id.clone(),
            command: entry.command.clone(),
            exit_code,
        }
    }
}

fn signal_process_tree(pid: i32, sig: Signal) {
    let children_path = format!("/proc/{pid}/task/{pid}/children");
    if let Ok(content) = std::fs::read_to_string(&children_path) {
        for child_str in content.split_whitespace() {
            if let Ok(child_pid) = child_str.parse::<i32>() {
                signal_process_tree(child_pid, sig);
                let _ = kill(Pid::from_raw(child_pid), sig);
            }
        }
    }
}

fn is_process_alive(pid: i32) -> bool {
    std::fs::metadata(format!("/proc/{pid}")).is_ok()
}

async fn terminate_session(child: &mut tokio::process::Child) {
    let Some(pid) = child.id() else {
        return;
    };
    let pid_i32 = pid as i32;

    signal_process_tree(pid_i32, Signal::SIGTERM);
    let _ = killpg(Pid::from_raw(pid_i32), Signal::SIGTERM);

    let deadline = tokio::time::Instant::now() + TERMINATION_GRACE_PERIOD;
    loop {
        if !is_process_alive(pid_i32) {
            return;
        }
        if tokio::time::Instant::now() >= deadline {
            break;
        }
        tokio::time::sleep(TERMINATION_CHECK_INTERVAL).await;
    }

    warn!("session child did not exit within grace period, sending SIGKILL");
    signal_process_tree(pid_i32, Signal::SIGKILL);
    let _ = killpg(Pid::from_raw(pid_i32), Signal::SIGKILL);
    let _ = child.start_kill();
    let _ = child.wait().await;
}

#[utoipa::path(
    post,
    path = "/process/session",
    tag = "process",
    operation_id = "createSession",
    request_body = CreateSessionRequest,
    responses(
        (status = 201),
    )
)]
pub async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<impl IntoResponse, AppError> {
    let sc = &state.sessions;

    let entry = match sc.sessions.entry(req.session_id.clone()) {
        Entry::Occupied(_) => return Err(AppError::conflict("session already exists")),
        Entry::Vacant(v) => v,
    };

    let shell = get_shell();
    let mut cmd = Command::new(&shell);
    cmd.current_dir(&sc.project_dir);
    cmd.stdin(std::process::Stdio::piped());
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());
    cmd.process_group(0);

    let mut child = cmd.spawn().map_err(|e| AppError::internal(e.to_string()))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| AppError::internal("failed to take stdin"))?;

    let session_dir = SessionInner::dir(&sc.config_dir, &req.session_id);
    tokio::fs::create_dir_all(&session_dir)
        .await
        .map_err(AppError::from)?;

    entry.insert(SessionInner {
        stdin,
        commands: DashMap::default(),
        _child: child,
        cancel: CancellationToken::default(),
    });

    Ok(StatusCode::CREATED)
}

#[utoipa::path(
    get,
    path = "/process/session",
    tag = "process",
    operation_id = "listSessions",
    responses(
        (status = 200, body = Vec<SessionDto>),
    )
)]
pub async fn list_sessions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<SessionDto>>, AppError> {
    let sc = &state.sessions;
    let mut dtos = Vec::default();

    for entry in sc.sessions.iter() {
        let session_id = entry.key().clone();
        let commands: Vec<CommandDto> = entry
            .value()
            .commands
            .iter()
            .map(|cmd| sc.get_command_dto(&session_id, cmd.value()))
            .collect();

        dtos.push(SessionDto {
            session_id,
            commands,
        });
    }

    Ok(Json(dtos))
}

#[utoipa::path(
    get,
    path = "/process/session/{sessionId}",
    tag = "process",
    operation_id = "getSession",
    params(
        ("sessionId" = String, Path,),
    ),
    responses(
        (status = 200, body = SessionDto),
    )
)]
pub async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<SessionDto>, AppError> {
    let sc = &state.sessions;
    let session = sc
        .sessions
        .get(&session_id)
        .ok_or_else(|| AppError::not_found("session not found"))?;

    let commands: Vec<CommandDto> = session
        .commands
        .iter()
        .map(|cmd| sc.get_command_dto(&session_id, cmd.value()))
        .collect();

    Ok(Json(SessionDto {
        session_id,
        commands,
    }))
}

#[utoipa::path(
    delete,
    path = "/process/session/{sessionId}",
    tag = "process",
    operation_id = "deleteSession",
    params(
        ("sessionId" = String, Path,),
    ),
    responses(
        (status = 204),
    )
)]
pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let sc = &state.sessions;

    let (_, mut session) = sc
        .sessions
        .remove(&session_id)
        .ok_or_else(|| AppError::not_found("session not found"))?;

    session.cancel.cancel();
    terminate_session(&mut session._child).await;

    let dir = SessionInner::dir(&sc.config_dir, &session_id);
    let _ = tokio::fs::remove_dir_all(dir).await;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/process/session/{sessionId}/command/{commandId}",
    tag = "process",
    operation_id = "getCommand",
    params(
        ("sessionId" = String, Path,),
        ("commandId" = String, Path,),
    ),
    responses(
        (status = 200, body = CommandDto),
    )
)]
pub async fn get_command(
    State(state): State<Arc<AppState>>,
    Path((session_id, cmd_id)): Path<(String, String)>,
) -> Result<Json<CommandDto>, AppError> {
    let sc = &state.sessions;
    let session = sc
        .sessions
        .get(&session_id)
        .ok_or_else(|| AppError::not_found("session not found"))?;

    let entry = session
        .commands
        .get(&cmd_id)
        .ok_or_else(|| AppError::not_found("command not found"))?;

    Ok(Json(sc.get_command_dto(&session_id, &entry)))
}
