// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::{Context, Result};
use bollard::image::{CommitContainerOptions, CreateImageOptions};
use bytes::{Bytes, BytesMut};
use futures_util::StreamExt;
use tracing::{info, warn};

use super::DockerClient;

const MAX_COMMIT_RETRIES: u32 = 3;

impl DockerClient {
    /// Commit a container to an image with automatic fallback to export/import on failure
    pub async fn commit_container(&self, container_id: &str, image_name: &str) -> Result<()> {
        for attempt in 1..=MAX_COMMIT_RETRIES {
            info!(
                container = %container_id,
                attempt = attempt,
                max = MAX_COMMIT_RETRIES,
                "committing container"
            );

            let options = CommitContainerOptions {
                container: container_id.to_string(),
                repo: image_name.to_string(),
                pause: false,
                ..Default::default()
            };

            match self
                .api_client
                .commit_container(options, bollard::container::Config::<String>::default())
                .await
            {
                Ok(response) => {
                    info!(
                        container = %container_id,
                        image_id = %response.id.as_deref().unwrap_or("unknown"),
                        "container committed successfully"
                    );
                    return Ok(());
                }
                Err(err) => {
                    // Check if error is related to digest failure
                    let err_str = err.to_string();
                    if err_str.contains("failed to get digest") {
                        warn!(
                            container = %container_id,
                            "commit failed with digest error, attempting export/import fallback"
                        );

                        match self.export_import_container(container_id, image_name).await {
                            Ok(()) => {
                                info!(
                                    container = %container_id,
                                    "container successfully backed up using export/import method"
                                );
                                return Ok(());
                            }
                            Err(fallback_err) => {
                                warn!(
                                    container = %container_id,
                                    error = %fallback_err,
                                    "export/import fallback also failed"
                                );
                            }
                        }
                    }

                    if attempt < MAX_COMMIT_RETRIES {
                        warn!(
                            container = %container_id,
                            attempt = attempt,
                            max = MAX_COMMIT_RETRIES,
                            error = %err,
                            "failed to commit container, retrying"
                        );
                        continue;
                    }

                    return Err(anyhow::anyhow!(
                        "failed to commit container after {} attempts: {}",
                        MAX_COMMIT_RETRIES,
                        err
                    ));
                }
            }
        }

        Ok(())
    }

    /// Export a container and import it as an image (fallback method)
    async fn export_import_container(&self, container_id: &str, image_name: &str) -> Result<()> {
        info!(
            container = %container_id,
            image = %image_name,
            "exporting container and importing as image"
        );

        // Inspect container to get configuration
        let container_info = self
            .api_client
            .inspect_container(container_id, None)
            .await
            .context("failed to inspect container")?;

        // Export the container and collect into buffer
        let mut buf = BytesMut::default();
        let mut export_stream = self.api_client.export_container(container_id);
        while let Some(chunk) = export_stream.next().await {
            let chunk = chunk.context("failed to read export stream chunk")?;
            buf.extend_from_slice(&chunk);
        }
        let tar_data: Bytes = buf.freeze();

        // Build configuration changes to preserve container config
        let mut changes = Vec::default();

        // Preserve CMD
        if let Some(ref config) = container_info.config {
            if let Some(ref cmd) = config.cmd {
                if !cmd.is_empty() {
                    let cmd_str = build_dockerfile_cmd(cmd);
                    changes.push(format!("CMD {}", cmd_str));
                }
            }

            // Preserve ENTRYPOINT
            if let Some(ref entrypoint) = config.entrypoint {
                if !entrypoint.is_empty() {
                    let entrypoint_str = build_dockerfile_cmd(entrypoint);
                    changes.push(format!("ENTRYPOINT {}", entrypoint_str));
                }
            }

            // Preserve environment variables
            if let Some(ref env) = config.env {
                for env_var in env {
                    if let Some((key, value)) = env_var.split_once('=') {
                        changes.push(format!("ENV {}=\"{}\"", key, value.replace('\"', "\\\"")));
                    }
                }
            }

            // Preserve working directory
            if let Some(ref workdir) = config.working_dir {
                if !workdir.is_empty() {
                    changes.push(format!("WORKDIR {}", workdir));
                }
            }

            // Preserve exposed ports
            if let Some(ref exposed_ports) = config.exposed_ports {
                for port in exposed_ports.keys() {
                    changes.push(format!("EXPOSE {}", port));
                }
            }

            // Preserve user
            if let Some(ref user) = config.user {
                if !user.is_empty() {
                    changes.push(format!("USER {}", user));
                }
            }
        }

        info!(changes = ?changes, "applying configuration changes");

        // Create image from exported container data
        let change_refs: Vec<&str> = changes.iter().map(String::as_str).collect();
        let options = CreateImageOptions {
            from_src: "-",
            repo: image_name,
            changes: change_refs,
            ..Default::default()
        };

        let mut import_stream = self
            .api_client
            .create_image(Some(options), Some(tar_data), None);

        // Consume the import stream
        while let Some(result) = import_stream.next().await {
            result.context("failed to create image from export")?;
        }

        info!(
            container = %container_id,
            image = %image_name,
            "container successfully exported and imported with preserved configuration"
        );

        Ok(())
    }
}

/// Convert a slice of command arguments to Dockerfile CMD/ENTRYPOINT format
fn build_dockerfile_cmd(cmd: &[String]) -> String {
    if cmd.is_empty() {
        return String::default();
    }

    // Use JSON array format
    let quoted_args: Vec<String> = cmd
        .iter()
        .map(|arg| {
            let escaped = arg.replace('\\', "\\\\").replace('\"', "\\\"");
            format!("\"{}\"", escaped)
        })
        .collect();

    format!("[{}]", quoted_args.join(", "))
}
