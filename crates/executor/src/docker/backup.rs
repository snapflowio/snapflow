// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use anyhow::{Context, Result};
use bollard::image::RemoveImageOptions;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};

use crate::api::dto::backup::CreateBackupDTO;
use crate::api::dto::registry::RegistryDTO;
use crate::models::BackupState;

use super::DockerClient;

impl DockerClient {
    pub fn start_backup(self: &Arc<Self>, sandbox_id: &str, dto: &CreateBackupDTO) {
        if let Some(existing) = self.backup_tokens.get(sandbox_id) {
            existing.value().cancel();
        }

        let token = CancellationToken::default();
        self.backup_tokens
            .insert(sandbox_id.to_owned(), token.clone());

        let cache = Arc::clone(&self.cache);
        let sandbox_id_owned = sandbox_id.to_owned();
        let snapshot = dto.image.clone();
        let registry = dto.registry.clone();
        let docker = Arc::clone(self);
        let semaphore = Arc::clone(&self.backup_semaphore);

        tokio::spawn(async move {
            let _permit = match semaphore.acquire().await {
                Ok(permit) => permit,
                Err(_) => {
                    error!(sandbox_id = %sandbox_id_owned, "backup semaphore closed");
                    cache
                        .set_backup_state(
                            &sandbox_id_owned,
                            BackupState::Failed,
                            Some("backup semaphore closed".to_owned()),
                        )
                        .await;
                    return;
                }
            };

            cache
                .set_backup_state(&sandbox_id_owned, BackupState::InProgress, None)
                .await;

            let result = docker
                .run_backup(&sandbox_id_owned, &snapshot, &registry, &token)
                .await;

            docker.backup_tokens.remove(&sandbox_id_owned);

            match result {
                Ok(()) => {
                    cache
                        .set_backup_state(&sandbox_id_owned, BackupState::Completed, None)
                        .await;
                    info!(
                        sandbox_id = %sandbox_id_owned,
                        snapshot = %snapshot,
                        "backup completed successfully"
                    );
                }
                Err(ref _e) if token.is_cancelled() => {
                    cache
                        .set_backup_state(&sandbox_id_owned, BackupState::None, None)
                        .await;
                    info!(sandbox_id = %sandbox_id_owned, "backup cancelled");
                }
                Err(e) => {
                    let err_msg = format!("{e:#}");
                    error!(
                        sandbox_id = %sandbox_id_owned,
                        error = %err_msg,
                        "backup failed"
                    );
                    cache
                        .set_backup_state(&sandbox_id_owned, BackupState::Failed, Some(err_msg))
                        .await;
                }
            }
        });
    }

    async fn run_backup(
        &self,
        sandbox_id: &str,
        snapshot: &str,
        registry: &RegistryDTO,
        token: &CancellationToken,
    ) -> Result<()> {
        // Commit container with cancellation support
        tokio::select! {
            result = self.commit_container(sandbox_id, snapshot) => {
                result?;
            }
            _ = token.cancelled() => {
                anyhow::bail!("backup cancelled during container commit");
            }
        }

        if token.is_cancelled() {
            anyhow::bail!("backup cancelled");
        }

        self.push_image_cancellable(snapshot, Some(registry), token)
            .await
            .context("failed to push backup image to registry")?;

        if let Err(e) = self.remove_backup_image(snapshot).await {
            warn!(
                sandbox_id = %sandbox_id,
                snapshot = %snapshot,
                error = %e,
                "failed to remove local backup image (non-fatal)"
            );
        }

        Ok(())
    }

    async fn push_image_cancellable(
        &self,
        image: &str,
        registry: Option<&RegistryDTO>,
        token: &CancellationToken,
    ) -> Result<()> {
        tokio::select! {
            result = self.push_image(image, registry) => result,
            _ = token.cancelled() => anyhow::bail!("backup cancelled during push"),
        }
    }

    async fn remove_backup_image(&self, image: &str) -> Result<()> {
        self.api_client
            .remove_image(
                image,
                Some(RemoveImageOptions {
                    force: true,
                    ..Default::default()
                }),
                None,
            )
            .await
            .map_err(|e| anyhow::anyhow!("failed to remove image: {e}"))?;

        Ok(())
    }
}
