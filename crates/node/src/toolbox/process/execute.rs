// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::{ExecuteRequest, ExecuteResponse};
use snapflow_errors::AppError;
use crate::common::shell::get_shell;
use axum::Json;
use tokio::process::Command;

#[utoipa::path(
    post,
    path = "/process/execute",
    tag = "process",
    operation_id = "executeCommand",
    request_body = ExecuteRequest,
    responses(
        (status = 200, body = ExecuteResponse),
    )
)]
pub async fn execute_command(
    Json(req): Json<ExecuteRequest>,
) -> Result<Json<ExecuteResponse>, AppError> {
    if req.command.trim().is_empty() {
        return Err(AppError::bad_request("empty command"));
    }

    let timeout_secs = req.timeout.unwrap_or(360) as u64;
    let timeout = std::time::Duration::from_secs(timeout_secs);

    let shell = get_shell();
    let mut cmd = Command::new(&shell);
    cmd.arg("-c").arg(&req.command);

    if let Some(cwd) = &req.cwd {
        cmd.current_dir(cwd);
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    unsafe {
        cmd.pre_exec(|| {
            nix::unistd::setsid().map_err(|e| std::io::Error::other(e))?;
            Ok(())
        });
    }

    let child = cmd
        .spawn()
        .map_err(|e| AppError::bad_request(e.to_string()))?;

    let pid = child.id();

    match tokio::time::timeout(timeout, child.wait_with_output()).await {
        Ok(Ok(output)) => {
            let mut combined = output.stdout;
            combined.extend_from_slice(&output.stderr);
            Ok(Json(ExecuteResponse {
                exit_code: output.status.code().unwrap_or(-1),
                result: String::from_utf8_lossy(&combined).to_string(),
            }))
        }
        Ok(Err(e)) => Ok(Json(ExecuteResponse {
            exit_code: -1,
            result: e.to_string(),
        })),
        Err(_) => {
            if let Some(pid) = pid {
                let _ = nix::sys::signal::kill(
                    nix::unistd::Pid::from_raw(-(pid as i32)),
                    nix::sys::signal::Signal::SIGKILL,
                );
            }
            Err(AppError::timeout("command execution timeout"))
        }
    }
}
