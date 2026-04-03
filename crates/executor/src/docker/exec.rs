// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::Result;
use bollard::exec::{CreateExecOptions, StartExecResults};
use futures_util::StreamExt;

use super::DockerClient;

pub struct ExecResult {
    pub stderr: String,
    pub exit_code: i64,
}

impl DockerClient {
    pub async fn exec_sync(
        &self,
        container_id: &str,
        cmd: Vec<&str>,
        env: Option<Vec<&str>>,
        attach_stdout: bool,
        attach_stderr: bool,
        tty: bool,
    ) -> Result<ExecResult> {
        let mut exec_env = vec!["DEBIAN_FRONTEND=noninteractive"];
        if let Some(ref extra_env) = env {
            exec_env.extend(extra_env.iter());
        }

        let exec = self
            .api_client
            .create_exec(
                container_id,
                CreateExecOptions {
                    cmd: Some(cmd.iter().map(|s| s.to_string()).collect()),
                    env: Some(exec_env.iter().map(|s| s.to_string()).collect()),
                    attach_stdout: Some(attach_stdout),
                    attach_stderr: Some(attach_stderr),
                    tty: Some(tty),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| anyhow::anyhow!("failed to create exec: {}", e))?;

        let exec_id = exec.id;

        let start_result = self
            .api_client
            .start_exec(
                &exec_id,
                Some(bollard::exec::StartExecOptions {
                    detach: false,
                    ..Default::default()
                }),
            )
            .await
            .map_err(|e| anyhow::anyhow!("failed to start exec: {}", e))?;

        let mut stderr_buf = String::default();

        if let StartExecResults::Attached { mut output, .. } = start_result {
            while let Some(Ok(msg)) = output.next().await {
                if let bollard::container::LogOutput::StdErr { message } = msg {
                    stderr_buf.push_str(&String::from_utf8_lossy(&message));
                }
            }
        }

        let inspect = self
            .api_client
            .inspect_exec(&exec_id)
            .await
            .map_err(|e| anyhow::anyhow!("failed to inspect exec: {}", e))?;

        let exit_code = inspect.exit_code.unwrap_or(-1);

        Ok(ExecResult {
            stderr: stderr_buf,
            exit_code,
        })
    }
}
