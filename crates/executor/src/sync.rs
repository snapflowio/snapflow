// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use reqwest::Client;
use serde::Serialize;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

use crate::docker::DockerClient;
use crate::models::SandboxState;

#[derive(Serialize)]
struct SandboxStateUpdate {
    state: SandboxState,
}

pub struct SandboxSyncService {
    docker: Arc<DockerClient>,
    interval: Duration,
    server_url: String,
    api_token: String,
    http_client: Client,
    cancel: CancellationToken,
}

impl SandboxSyncService {
    pub fn new(
        docker: Arc<DockerClient>,
        interval: Duration,
        server_url: String,
        api_token: String,
        cancel: CancellationToken,
    ) -> Self {
        Self {
            docker,
            interval,
            server_url,
            api_token,
            http_client: Client::default(),
            cancel,
        }
    }

    pub fn start(self: Arc<Self>) {
        let svc = Arc::clone(&self);
        tokio::spawn(async move {
            svc.run().await;
        });
    }

    async fn run(&self) {
        info!("starting sandbox sync service");

        if let Err(e) = self.perform_sync().await {
            error!("failed to perform initial sync: {e}");
        }

        let mut ticker = tokio::time::interval(self.interval);
        loop {
            tokio::select! {
                _ = self.cancel.cancelled() => {
                    info!("sandbox sync service stopped");
                    return;
                }
                _ = ticker.tick() => {
                    if let Err(e) = self.perform_sync().await {
                        error!("failed to perform sync: {e}");
                    }
                }
            }
        }
    }

    async fn perform_sync(&self) -> anyhow::Result<()> {
        let local_states = self.get_local_container_states().await?;

        let mut sync_count = 0u32;
        for (sandbox_id, local_state) in &local_states {
            if let Err(e) = self.sync_sandbox_state(sandbox_id, local_state).await {
                error!(sandbox_id = %sandbox_id, "failed to sync state: {e}");
                continue;
            }
            sync_count += 1;
        }

        if sync_count > 0 {
            info!("synchronized {sync_count} sandbox states");
        }

        Ok(())
    }

    async fn get_local_container_states(&self) -> anyhow::Result<HashMap<String, SandboxState>> {
        let containers = self.docker.list_snapflow_containers().await?;
        let mut states = HashMap::default();

        for container in containers {
            let sandbox_id = match extract_sandbox_id(&container) {
                Some(id) => id,
                None => continue,
            };

            let (state, _) = self.docker.deduce_sandbox_state(&sandbox_id).await;
            states.insert(sandbox_id, state);
        }

        Ok(states)
    }

    async fn sync_sandbox_state(
        &self,
        sandbox_id: &str,
        state: &SandboxState,
    ) -> anyhow::Result<()> {
        let url = format!(
            "{}/sandboxes/{}/state",
            self.server_url.trim_end_matches('/'),
            sandbox_id
        );

        let body = SandboxStateUpdate { state: *state };

        let response = self
            .http_client
            .put(&url)
            .bearer_auth(&self.api_token)
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!(
                "failed to sync sandbox {}: HTTP {}",
                sandbox_id,
                response.status()
            );
        }

        Ok(())
    }
}

fn extract_sandbox_id(container: &bollard::models::ContainerSummary) -> Option<String> {
    container
        .names
        .as_ref()
        .and_then(|names| names.first())
        .map(|name| name.trim_start_matches('/').to_owned())
        .filter(|name| !name.is_empty())
}
