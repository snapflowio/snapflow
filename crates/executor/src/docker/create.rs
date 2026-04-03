// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use anyhow::Result;
use bollard::container::CreateContainerOptions;
use tracing::{error, info};

use crate::api::dto::sandbox::CreateSandboxDTO;
use crate::models::SandboxState;

use super::DockerClient;

impl DockerClient {
    pub async fn create(self: &Arc<Self>, sandbox_dto: &CreateSandboxDTO) -> Result<String> {
        let (state, err) = self.deduce_sandbox_state(&sandbox_dto.id).await;
        if state == SandboxState::Error {
            if let Some(e) = err {
                return Err(e);
            }
        }

        if matches!(
            state,
            SandboxState::Started | SandboxState::PullingImage | SandboxState::Starting
        ) {
            return Ok(sandbox_dto.id.clone());
        }

        if matches!(state, SandboxState::Stopped | SandboxState::Creating) {
            let _ = self
                .start(&sandbox_dto.id, sandbox_dto.metadata.as_ref())
                .await?;
            return Ok(sandbox_dto.id.clone());
        }

        self.cache
            .set_sandbox_state(&sandbox_dto.id, SandboxState::Creating)
            .await;

        if let Err(e) = self
            .pull_image_with_sandbox(
                &sandbox_dto.image,
                sandbox_dto.registry.as_ref(),
                Some(&sandbox_dto.id),
            )
            .await
        {
            self.cache
                .set_sandbox_state(&sandbox_dto.id, SandboxState::Error)
                .await;
            return Err(e);
        }

        self.cache
            .set_sandbox_state(&sandbox_dto.id, SandboxState::Creating)
            .await;

        if let Err(e) = self.validate_image_architecture(&sandbox_dto.image).await {
            error!(error = %e, "image architecture validation failed");
            self.cache
                .set_sandbox_state(&sandbox_dto.id, SandboxState::Error)
                .await;
            return Err(e);
        }

        let bucket_binds = if let Some(ref buckets) = sandbox_dto.buckets {
            self.get_buckets_mount_path_binds(buckets).await?
        } else {
            Vec::default()
        };

        let container_config = self.build_container_config(sandbox_dto);
        let host_config = self.build_host_config(sandbox_dto, bucket_binds).await?;
        let networking_config = self.build_networking_config();

        let options = CreateContainerOptions {
            name: sandbox_dto.id.clone(),
            platform: Some("linux/amd64".to_string()),
        };

        let create_config = bollard::container::Config {
            host_config: Some(host_config),
            networking_config,
            ..container_config
        };

        let response = match self
            .api_client
            .create_container(Some(options), create_config)
            .await
        {
            Ok(response) => response,
            Err(bollard::errors::Error::DockerResponseServerError {
                status_code: 409, ..
            }) => {
                info!(
                    sandbox_id = %sandbox_dto.id,
                    "container already exists, returning sandbox id"
                );
                return Ok(sandbox_dto.id.clone());
            }
            Err(e) => {
                self.cache
                    .set_sandbox_state(&sandbox_dto.id, SandboxState::Error)
                    .await;
                return Err(anyhow::anyhow!("failed to create container: {}", e));
            }
        };

        info!(
            sandbox_id = %sandbox_dto.id,
            container_id = %response.id,
            "container created"
        );

        let ip = self
            .start(&sandbox_dto.id, sandbox_dto.metadata.as_ref())
            .await?;

        let container_short_id = if response.id.len() >= 12 {
            response.id[..12].to_owned()
        } else {
            response.id.clone()
        };

        if !ip.is_empty() {
            let block_all = sandbox_dto.network_block_all.unwrap_or(false);
            let allow_list = sandbox_dto
                .network_allow_list
                .as_ref()
                .map(|v| v.join(","))
                .unwrap_or_default();

            if block_all {
                let nrm = Arc::clone(&self.net_rules_manager);
                let short_id = container_short_id.clone();
                let ip_clone = ip.clone();
                tokio::spawn(async move {
                    if let Err(e) = nrm.set_network_rules(&short_id, &ip_clone, "").await {
                        error!("failed to set network block rules: {e}");
                    }
                });
            } else if !allow_list.is_empty() {
                let nrm = Arc::clone(&self.net_rules_manager);
                let short_id = container_short_id.clone();
                let ip_clone = ip.clone();
                tokio::spawn(async move {
                    if let Err(e) = nrm
                        .set_network_rules(&short_id, &ip_clone, &allow_list)
                        .await
                    {
                        error!("failed to set network allow list rules: {e}");
                    }
                });
            }

            let limit_egress = sandbox_dto
                .metadata
                .as_ref()
                .and_then(|m| m.get("limitNetworkEgress"))
                .map(|v| v == "true")
                .unwrap_or(false);

            if limit_egress {
                let nrm = Arc::clone(&self.net_rules_manager);
                let short_id = container_short_id;
                let ip_clone = ip;
                tokio::spawn(async move {
                    if let Err(e) = nrm.set_network_limiter(&short_id, &ip_clone).await {
                        error!("failed to set network limiter: {e}");
                    }
                });
            }
        }

        Ok(response.id)
    }

    async fn validate_image_architecture(&self, image: &str) -> Result<()> {
        let inspect = self
            .api_client
            .inspect_image(image)
            .await
            .map_err(|e| anyhow::anyhow!("failed to inspect image: {}", e))?;

        let arch = inspect.architecture.as_deref().unwrap_or("").to_lowercase();

        let valid_archs = ["amd64", "x86_64"];
        if valid_archs.contains(&arch.as_str()) {
            return Ok(());
        }

        anyhow::bail!(
            "conflict: image {} architecture ({}) is not x64 compatible",
            image,
            arch
        )
    }
}
