// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use anyhow::Result;
use bollard::container::RemoveContainerOptions;
use tracing::{debug, error, warn};

use crate::models::SandboxState;

use super::{
    DEFAULT_BASE_DELAY, DEFAULT_MAX_DELAY, DEFAULT_MAX_RETRIES, DockerClient, is_docker_not_found,
};

impl DockerClient {
    pub async fn destroy(&self, container_id: &str) -> Result<()> {
        if let Some(token) = self.backup_tokens.get(container_id) {
            token.value().cancel();
        }

        let ct = match self.api_client.inspect_container(container_id, None).await {
            Ok(ct) => ct,
            Err(e) => {
                if is_docker_not_found(&e) {
                    self.cache
                        .set_sandbox_state(container_id, SandboxState::Destroyed)
                        .await;
                    return Ok(());
                }
                return Err(anyhow::Error::new(e).context("failed to inspect container"));
            }
        };

        let container_short_id = ct
            .id
            .as_deref()
            .map(|id| if id.len() >= 12 { &id[..12] } else { id })
            .unwrap_or("")
            .to_owned();

        let (state, _) = self.deduce_sandbox_state(container_id).await;
        if state == SandboxState::Destroyed || state == SandboxState::Destroying {
            debug!(container_id = %container_id, "sandbox is already destroyed or destroying");
            self.cache.set_sandbox_state(container_id, state).await;
            return Ok(());
        }

        self.cache
            .set_sandbox_state(container_id, SandboxState::Destroying)
            .await;

        if state == SandboxState::Stopped {
            let result = self
                .api_client
                .remove_container(
                    container_id,
                    Some(RemoveContainerOptions {
                        force: false,
                        v: true,
                        ..Default::default()
                    }),
                )
                .await;

            match result {
                Ok(()) => {
                    spawn_delete_netrules(
                        Arc::clone(&self.net_rules_manager),
                        container_short_id.clone(),
                    );
                    self.cache
                        .set_sandbox_state(container_id, SandboxState::Destroyed)
                        .await;
                    return Ok(());
                }
                Err(e) if is_docker_not_found(&e) => {
                    self.cache
                        .set_sandbox_state(container_id, SandboxState::Destroyed)
                        .await;
                    return Ok(());
                }
                Err(e) => {
                    warn!(
                        container_id = %container_id,
                        error = %e,
                        "failed to remove stopped sandbox without force"
                    );
                    warn!(container_id = %container_id, "trying to remove stopped sandbox with force");
                }
            }
        }

        let cid = container_id.to_owned();
        let api = self.api_client.clone();
        let result = self
            .retry_with_backoff(
                "remove",
                container_id,
                DEFAULT_MAX_RETRIES,
                DEFAULT_BASE_DELAY,
                DEFAULT_MAX_DELAY,
                || {
                    let cid = cid.clone();
                    let api = api.clone();
                    async move {
                        api.remove_container(
                            &cid,
                            Some(RemoveContainerOptions {
                                force: true,
                                ..Default::default()
                            }),
                        )
                        .await
                        .map_err(|e| anyhow::Error::from(e))
                    }
                },
            )
            .await;

        if let Err(e) = result {
            if e.downcast_ref::<bollard::errors::Error>()
                .is_some_and(is_docker_not_found)
            {
                self.cache
                    .set_sandbox_state(container_id, SandboxState::Destroyed)
                    .await;
                return Ok(());
            }
            return Err(e);
        }

        spawn_delete_netrules(Arc::clone(&self.net_rules_manager), container_short_id);

        self.cache
            .set_sandbox_state(container_id, SandboxState::Destroyed)
            .await;

        Ok(())
    }
}

fn spawn_delete_netrules(nrm: Arc<crate::netrules::NetRulesManager>, container_short_id: String) {
    tokio::spawn(async move {
        if let Err(e) = nrm.delete_network_rules(&container_short_id).await {
            error!("failed to delete network rules for {container_short_id}: {e}");
        }
    });
}
