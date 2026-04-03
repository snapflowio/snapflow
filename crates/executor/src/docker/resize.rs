// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::Result;
use bollard::container::UpdateContainerOptions;

use crate::api::dto::sandbox::ResizeSandboxDTO;
use crate::models::SandboxState;

use super::DockerClient;

impl DockerClient {
    pub async fn resize(&self, sandbox_id: &str, dto: &ResizeSandboxDTO) -> Result<()> {
        self.cache
            .set_sandbox_state(sandbox_id, SandboxState::Resizing)
            .await;

        let result = self
            .api_client
            .update_container(
                sandbox_id,
                UpdateContainerOptions::<String> {
                    cpu_quota: Some(i64::from(dto.cpu) * 100_000),
                    cpu_period: Some(100_000),
                    memory: Some(i64::from(dto.memory) * 1024 * 1024 * 1024),
                    memory_swap: Some(i64::from(dto.memory) * 1024 * 1024 * 1024),
                    ..Default::default()
                },
            )
            .await;

        match result {
            Ok(_) => {
                self.cache
                    .set_sandbox_state(sandbox_id, SandboxState::Started)
                    .await;
                Ok(())
            }
            Err(e) => {
                self.cache
                    .set_sandbox_state(sandbox_id, SandboxState::Started)
                    .await;
                Err(anyhow::anyhow!("failed to resize container: {}", e))
            }
        }
    }
}
