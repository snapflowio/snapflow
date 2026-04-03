// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::Result;
use bollard::models::ContainerInspectResponse;

use crate::models::SandboxState;
use crate::netrules::NetworkSettings;

use super::{DockerClient, is_docker_not_found};

impl DockerClient {
    pub async fn container_inspect(&self, container_id: &str) -> Result<ContainerInspectResponse> {
        self.api_client
            .inspect_container(container_id, None)
            .await
            .map_err(|e| anyhow::anyhow!("failed to inspect container: {}", e))
    }

    pub fn get_container_ip(&self, inspect: &ContainerInspectResponse) -> Option<String> {
        let ip = crate::netrules::get_container_ip(inspect);
        if ip.is_empty() { None } else { Some(ip) }
    }

    pub async fn set_network_rules(
        &self,
        container_short_id: &str,
        ip_address: &str,
        allow_list: &str,
    ) -> Result<()> {
        self.net_rules_manager
            .set_network_rules(container_short_id, ip_address, allow_list)
            .await
    }

    pub async fn set_network_limiter(
        &self,
        container_short_id: &str,
        ip_address: &str,
    ) -> Result<()> {
        self.net_rules_manager
            .set_network_limiter(container_short_id, ip_address)
            .await
    }

    pub async fn get_network_settings(&self, container_short_id: &str) -> Result<NetworkSettings> {
        self.net_rules_manager
            .get_network_settings(container_short_id)
            .await
    }

    pub async fn deduce_sandbox_state(
        &self,
        sandbox_id: &str,
    ) -> (SandboxState, Option<anyhow::Error>) {
        if sandbox_id.is_empty() {
            return (SandboxState::Unknown, None);
        }

        let container = match self.api_client.inspect_container(sandbox_id, None).await {
            Ok(c) => c,
            Err(e) => {
                if is_docker_not_found(&e) {
                    return (SandboxState::Destroyed, None);
                }
                return (
                    SandboxState::Error,
                    Some(anyhow::anyhow!("failed to inspect container: {}", e)),
                );
            }
        };

        let state = match container.state {
            Some(ref state) => state,
            None => return (SandboxState::Unknown, None),
        };

        let status = state.status.as_ref().map(|s| s.as_ref()).unwrap_or("");

        match status {
            "created" => (SandboxState::Creating, None),
            "running" => {
                let cached = self.cache.get_or_default(sandbox_id).await;
                if cached.sandbox_state == SandboxState::PullingImage {
                    (SandboxState::PullingImage, None)
                } else {
                    (SandboxState::Started, None)
                }
            }
            "paused" => (SandboxState::Stopped, None),
            "restarting" => (SandboxState::Starting, None),
            "removing" => (SandboxState::Destroying, None),
            "exited" => {
                let exit_code = state.exit_code.unwrap_or(-1);
                if exit_code == 0 || exit_code == 137 || exit_code == 143 {
                    (SandboxState::Stopped, None)
                } else {
                    let error_msg = state.error.clone().unwrap_or_default();
                    (
                        SandboxState::Error,
                        Some(anyhow::anyhow!(
                            "container exited with code {}, reason: {}",
                            exit_code,
                            error_msg
                        )),
                    )
                }
            }
            "dead" => (SandboxState::Destroyed, None),
            _ => (SandboxState::Unknown, None),
        }
    }

    pub async fn get_container_ip_str(&self, container_id: &str) -> Result<String> {
        let container = self.container_inspect(container_id).await?;
        self.get_container_ip(&container)
            .ok_or_else(|| anyhow::anyhow!("container has no IP address, it might not be running"))
    }
}
