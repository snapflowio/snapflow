// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use tokio::net::TcpStream;
use tokio::time::{sleep, timeout};
use tracing::{error, info};

use crate::models::SandboxState;

use super::{DockerClient, NODE_PORT};

impl DockerClient {
    pub async fn start(
        self: &Arc<Self>,
        sandbox_id: &str,
        metadata: Option<&HashMap<String, String>>,
    ) -> Result<String> {
        self.cache
            .set_sandbox_state(sandbox_id, SandboxState::Starting)
            .await;

        if let Some(cancel) = self.backup_tokens.get(sandbox_id) {
            cancel.value().cancel();
        }

        let container = self
            .api_client
            .inspect_container(sandbox_id, None)
            .await
            .map_err(|e| anyhow::anyhow!("failed to inspect container: {}", e))?;

        let is_running = container
            .state
            .as_ref()
            .and_then(|s| s.running)
            .unwrap_or(false);

        if is_running {
            let container_ip = self.get_container_ip_str(sandbox_id).await?;
            self.wait_for_node_running(&container_ip, Duration::from_secs(10))
                .await?;
            self.cache
                .set_sandbox_state(sandbox_id, SandboxState::Started)
                .await;
            return Ok(container_ip);
        }

        self.api_client
            .start_container::<String>(sandbox_id, None)
            .await
            .map_err(|e| anyhow::anyhow!("failed to start container: {}", e))?;

        self.wait_for_container_running(sandbox_id, Duration::from_secs(10))
            .await?;

        let container_ip = self.get_container_ip_str(sandbox_id).await?;

        let docker_clone = Arc::clone(self);
        let sandbox_id_owned = sandbox_id.to_string();
        let handle = tokio::spawn(async move {
            docker_clone.start_snapflow_node(&sandbox_id_owned).await;
        });
        let sid = sandbox_id.to_string();
        tokio::spawn(async move {
            if let Err(e) = handle.await {
                error!(sandbox_id = %sid, error = %e, "snapflow node task panicked");
            }
        });

        self.wait_for_node_running(&container_ip, Duration::from_secs(10))
            .await?;

        self.cache
            .set_sandbox_state(sandbox_id, SandboxState::Started)
            .await;

        if metadata
            .and_then(|m| m.get("limitNetworkEgress"))
            .map(|v| v == "true")
            .unwrap_or(false)
        {
            if !container_ip.is_empty() {
                let short_id = if sandbox_id.len() >= 12 {
                    &sandbox_id[..12]
                } else {
                    sandbox_id
                };
                let nrm = Arc::clone(&self.net_rules_manager);
                let short_id_owned = short_id.to_owned();
                let ip_owned = container_ip.clone();
                tokio::spawn(async move {
                    if let Err(e) = nrm.set_network_limiter(&short_id_owned, &ip_owned).await {
                        error!(error = %e, "failed to set network limiter on start");
                    }
                });
            }
        }

        info!(sandbox_id = %sandbox_id, "Sandbox started");

        Ok(container_ip)
    }

    async fn wait_for_container_running(
        &self,
        container_id: &str,
        wait_timeout: Duration,
    ) -> Result<()> {
        let result = timeout(wait_timeout, async {
            loop {
                let container = self
                    .api_client
                    .inspect_container(container_id, None)
                    .await
                    .map_err(|e| anyhow::anyhow!("failed to inspect container: {}", e))?;

                let is_running = container
                    .state
                    .as_ref()
                    .and_then(|s| s.running)
                    .unwrap_or(false);

                if is_running {
                    return Ok::<(), anyhow::Error>(());
                }

                sleep(Duration::from_millis(10)).await;
            }
        })
        .await;

        match result {
            Ok(Ok(())) => Ok(()),
            Ok(Err(e)) => Err(e),
            Err(_) => anyhow::bail!("timeout waiting for container {} to start", container_id),
        }
    }

    async fn wait_for_node_running(
        &self,
        container_ip: &str,
        wait_timeout: Duration,
    ) -> Result<()> {
        let addr = format!("{container_ip}:{NODE_PORT}");

        let result = timeout(wait_timeout, async {
            loop {
                match TcpStream::connect(&addr).await {
                    Ok(_) => return Ok::<(), anyhow::Error>(()),
                    Err(_) => sleep(Duration::from_millis(5)).await,
                }
            }
        })
        .await;

        match result {
            Ok(Ok(())) => Ok(()),
            Ok(Err(e)) => Err(e),
            Err(_) => anyhow::bail!("timeout waiting for node to start"),
        }
    }
}
