// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;
use std::time::Duration;

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

use super::types::*;
use crate::common::errors::AppError;
use crate::toolbox::AppState;

const SYNC_EXECUTE_TIMEOUT: Duration = Duration::from_secs(300);

#[utoipa::path(
    post,
    path = "/process/session/{sessionId}/exec",
    tag = "process",
    operation_id = "sessionExecuteCommand",
    params(
        ("sessionId" = String, Path,),
    ),
    request_body = SessionExecuteRequest,
    responses(
        (status = 200, body = SessionExecuteResponse),
    )
)]
pub async fn execute_command(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(req): Json<SessionExecuteRequest>,
) -> Result<impl IntoResponse, AppError> {
    let sc = &state.sessions;
    let command_str = req.command.trim().to_string();
    if command_str.is_empty() {
        return Err(AppError::bad_request("command cannot be empty"));
    }

    let run_async = req.run_async || req.is_async;
    let cmd_id = uuid::Uuid::new_v4().to_string();

    let (log_path, exit_code_path) =
        SessionInner::log_file_path(&sc.config_dir, &session_id, &cmd_id);
    if let Some(parent) = log_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(AppError::from)?;
    }

    tokio::fs::File::create(&log_path)
        .await
        .map_err(|e| AppError::bad_request(format!("failed to create log file: {e}")))?;

    let log_dir = log_path
        .parent()
        .unwrap_or_else(|| std::path::Path::new("/tmp"));
    let shell_cmd = format!(
        r#"{{
log={log:?}
dir={dir:?}
sp="$dir/stdout.pipe.{cid}.$$"; ep="$dir/stderr.pipe.{cid}.$$"
rm -f "$sp" "$ep" && mkfifo "$sp" "$ep" || exit 1
cleanup() {{ rm -f "$sp" "$ep"; }}
trap 'cleanup' EXIT HUP INT TERM
( while IFS= read -r line || [ -n "$line" ]; do printf '\001\001\001%s\n' "$line"; done < "$sp" ) >> "$log" & r1=$!
( while IFS= read -r line || [ -n "$line" ]; do printf '\002\002\002%s\n' "$line"; done < "$ep" ) >> "$log" & r2=$!
{{ {cmd}; }} > "$sp" 2> "$ep"
echo "$?" >> {exit_code}
wait "$r1" "$r2"
cleanup
}}
"#,
        log = log_path.display(),
        dir = log_dir.display(),
        cid = cmd_id,
        cmd = command_str,
        exit_code = exit_code_path.display(),
    );

    let cancel_token: CancellationToken;
    {
        let mut session = sc
            .sessions
            .get_mut(&session_id)
            .ok_or_else(|| AppError::not_found("session not found"))?;

        cancel_token = session.cancel.clone();

        session.commands.insert(
            cmd_id.clone(),
            CommandEntry {
                id: cmd_id.clone(),
                command: command_str.clone(),
                exit_code: None,
            },
        );

        session
            .stdin
            .write_all(shell_cmd.as_bytes())
            .await
            .map_err(|e| AppError::bad_request(format!("failed to write command: {e}")))?;
    }

    if run_async {
        return Ok((
            StatusCode::ACCEPTED,
            Json(SessionExecuteResponse {
                cmd_id: Some(cmd_id),
                output: None,
                stdout: None,
                stderr: None,
                exit_code: None,
            }),
        )
            .into_response());
    }

    let poll_result = tokio::time::timeout(SYNC_EXECUTE_TIMEOUT, async {
        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    if let Some(session) = sc.sessions.get(&session_id)
                        && let Some(mut cmd) = session.commands.get_mut(&cmd_id) {
                            cmd.exit_code = Some(1);
                        }
                    return Err(AppError::bad_request("session cancelled"));
                }
                _ = tokio::time::sleep(Duration::from_millis(50)) => {
                    if let Ok(exit_str) = tokio::fs::read_to_string(&exit_code_path).await
                        && let Ok(code) = exit_str.trim().parse::<i32>()
                    {
                        if let Some(session) = sc.sessions.get(&session_id)
                            && let Some(mut cmd) = session.commands.get_mut(&cmd_id) {
                                cmd.exit_code = Some(code);
                            }

                        let log_content = tokio::fs::read_to_string(&log_path)
                            .await
                            .unwrap_or_default();

                        return Ok((Some(cmd_id.clone()), Some(log_content), Some(code)));
                    }
                }
            }
        }
    })
    .await;

    match poll_result {
        Ok(Ok((cmd_id, output, exit_code))) => Ok(Json(SessionExecuteResponse {
            cmd_id,
            output,
            stdout: None,
            stderr: None,
            exit_code,
        })
        .into_response()),
        Ok(Err(e)) => Err(e),
        Err(_) => Err(AppError::bad_request(format!(
            "command timed out after {}s — use async execution for long-running commands",
            SYNC_EXECUTE_TIMEOUT.as_secs()
        ))),
    }
}
