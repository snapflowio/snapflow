// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::time::Duration;

use anyhow::Result;
use bollard::container::{KillContainerOptions, StopContainerOptions, WaitContainerOptions};
use futures_util::StreamExt;
use tracing::warn;

use crate::models::SandboxState;

use super::DockerClient;

const WAIT_TIMEOUT: Duration = Duration::from_secs(30);

fn is_graceful_exit(err: &bollard::errors::Error) -> bool {
    matches!(
        err,
        bollard::errors::Error::DockerContainerWaitError { code, .. }
            if *code == 0 || *code == 137 || *code == 143
    )
}

impl DockerClient {
    pub async fn stop(&self, container_id: &str) -> Result<()> {
        let (state, err) = self.deduce_sandbox_state(container_id).await;
        if err.is_none() && state == SandboxState::Stopped {
            self.cache
                .set_sandbox_state(container_id, SandboxState::Stopped)
                .await;
            return Ok(());
        }

        self.cache
            .set_sandbox_state(container_id, SandboxState::Stopping)
            .await;

        if let Some(e) = err {
            warn!(
                container_id = %container_id,
                error = %e,
                "failed to deduce sandbox state, continuing with stop operation"
            );
        }

        if let Some(token) = self.backup_tokens.get(container_id) {
            token.value().cancel();
        }

        let api = &self.api_client;
        let id = container_id.to_owned();
        let retry_result = self
            .retryable("stop", container_id, || {
                let id = id.clone();
                async move {
                    api.stop_container(&id, Some(StopContainerOptions { t: 2 }))
                        .await
                        .map_err(|e| anyhow::anyhow!("{e}"))?;
                    Ok(())
                }
            })
            .await;

        if let Err(e) = retry_result {
            warn!(
                container_id = %container_id,
                error = %e,
                "failed to stop sandbox after retries, trying kill"
            );
            if let Err(kill_err) = self
                .api_client
                .kill_container(container_id, Some(KillContainerOptions { signal: "KILL" }))
                .await
            {
                warn!(
                    container_id = %container_id,
                    error = %kill_err,
                    "failed to kill sandbox"
                );
                return Err(anyhow::anyhow!("failed to kill sandbox: {kill_err}"));
            }
        }

        let mut wait_stream = self.api_client.wait_container(
            container_id,
            Some(WaitContainerOptions {
                condition: "not-running",
            }),
        );

        match tokio::time::timeout(WAIT_TIMEOUT, wait_stream.next()).await {
            Ok(Some(Ok(_))) => {
                self.cache
                    .set_sandbox_state(container_id, SandboxState::Stopped)
                    .await;
            }
            Ok(Some(Err(e))) if is_graceful_exit(&e) => {
                self.cache
                    .set_sandbox_state(container_id, SandboxState::Stopped)
                    .await;
            }
            Ok(Some(Err(e))) => {
                return Err(anyhow::anyhow!(
                    "error waiting for sandbox {} to stop: {}",
                    container_id,
                    e
                ));
            }
            Ok(None) => {
                self.cache
                    .set_sandbox_state(container_id, SandboxState::Stopped)
                    .await;
            }
            Err(_) => {
                warn!(
                    container_id = %container_id,
                    "timeout waiting for container to stop after {}s, container may still be running",
                    WAIT_TIMEOUT.as_secs()
                );
                self.cache
                    .set_sandbox_state(container_id, SandboxState::Error)
                    .await;
            }
        }

        Ok(())
    }
}
