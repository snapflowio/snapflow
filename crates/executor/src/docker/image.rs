// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::Result;
use bollard::image::{
    BuildImageOptions, CreateImageOptions, ListImagesOptions, PushImageOptions, RemoveImageOptions,
    TagImageOptions,
};
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;
use tracing::{debug, info};

use crate::api::dto::image::BuildImageRequestDTO;
use crate::api::dto::registry::RegistryDTO;
use crate::models::SandboxState;
use crate::storage::r2::R2Client;

use super::DockerClient;

impl DockerClient {
    /// Pulls an image, optionally tracking sandbox state.
    pub async fn pull_image_with_sandbox(
        &self,
        image: &str,
        registry: Option<&RegistryDTO>,
        sandbox_id: Option<&str>,
    ) -> Result<()> {
        let tag = image.rsplit_once(':').map(|(_, t)| t).unwrap_or("latest");

        if tag != "latest" {
            let exists = self.image_exists(image, true).await?;
            if exists {
                return Ok(());
            }
        }

        info!(image = %image, "Pulling image...");

        if let Some(sid) = sandbox_id {
            self.cache
                .set_sandbox_state(sid, SandboxState::PullingImage)
                .await;
        }

        let auth = get_registry_auth(registry);

        let options = CreateImageOptions {
            from_image: image.to_string(),
            ..Default::default()
        };

        let mut stream = self
            .api_client
            .create_image(Some(options), None, Some(auth));

        let mut last_status = String::new();
        while let Some(result) = stream.next().await {
            match result {
                Ok(info) => {
                    if let Some(ref status) = info.status {
                        if *status != last_status {
                            if let Some(ref id) = info.id {
                                debug!(id = %id, status = %status, "Image pull progress");
                            } else {
                                debug!(status = %status, "Image pull progress");
                            }
                            last_status = status.clone();
                        }
                    }
                    if let Some(ref error) = info.error {
                        return Err(anyhow::anyhow!("image pull error: {}", error));
                    }
                }
                Err(e) => return Err(anyhow::anyhow!("failed to pull image: {}", e)),
            }
        }

        info!(image = %image, "Image pulled successfully");
        Ok(())
    }

    /// Pulls an image without sandbox state tracking.
    pub async fn pull_image(&self, image: &str, registry: Option<&RegistryDTO>) -> Result<()> {
        self.pull_image_with_sandbox(image, registry, None).await
    }

    pub async fn build_image(
        &self,
        dto: &BuildImageRequestDTO,
        r2_client: Option<&R2Client>,
    ) -> Result<()> {
        let Some((repo, tag)) = dto.image.rsplit_once(':') else {
            anyhow::bail!("invalid image format: must contain a colon (e.g., 'myimage:1.0')");
        };
        if repo.is_empty() || tag.is_empty() {
            anyhow::bail!(
                "invalid image format: repo and tag must not be empty (e.g., 'myimage:1.0')"
            );
        }

        info!(image = %dto.image, "Building image...");

        let exists = self.image_exists(&dto.image, true).await?;
        if exists {
            info!(image = %dto.image, "Image already built");
            return Ok(());
        }

        let tar_bytes = self.build_tar_context(dto, r2_client).await?;

        let options = BuildImageOptions {
            t: dto.image.clone(),
            dockerfile: "Dockerfile".to_string(),
            rm: true,
            forcerm: true,
            pull: true,
            platform: "linux/amd64".to_string(),
            ..Default::default()
        };

        let mut stream = self
            .api_client
            .build_image(options, None, Some(tar_bytes.into()));

        let image_without_tag = dto
            .image
            .rsplit_once(':')
            .map(|(name, _)| name)
            .unwrap_or(&dto.image);

        let mut log_file = match crate::config::Config::from_env() {
            Ok(config) => match config.get_build_log_file_path(image_without_tag) {
                Ok(path) => tokio::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(path)
                    .await
                    .ok(),
                Err(_) => None,
            },
            Err(_) => None,
        };

        while let Some(result) = stream.next().await {
            match result {
                Ok(output) => {
                    if let Some(ref stream_str) = output.stream {
                        debug!("{}", stream_str.trim());
                        if let Some(ref mut f) = log_file {
                            let _ = f.write_all(stream_str.as_bytes()).await;
                        }
                    }
                    if let Some(ref error) = output.error {
                        return Err(anyhow::anyhow!("build error: {}", error));
                    }
                }
                Err(e) => return Err(anyhow::anyhow!("failed to build image: {}", e)),
            }
        }

        info!(image = %dto.image, "Image built successfully");
        Ok(())
    }

    async fn build_tar_context(
        &self,
        dto: &BuildImageRequestDTO,
        r2_client: Option<&R2Client>,
    ) -> Result<Vec<u8>> {
        let mut tar_buf = Vec::new();
        {
            let mut tar_builder = tar::Builder::new(&mut tar_buf);

            let dockerfile_bytes = dto.dockerfile.as_bytes();
            let mut header = tar::Header::new_gnu();
            header.set_path("Dockerfile")?;
            header.set_size(dockerfile_bytes.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            tar_builder.append(&header, dockerfile_bytes)?;

            if let (Some(context_hashes), Some(r2)) = (dto.context.as_ref(), r2_client) {
                for hash in context_hashes {
                    let tar_data =
                        r2.get_object(&dto.organization_id, hash)
                            .await
                            .map_err(|e| {
                                anyhow::anyhow!(
                                    "failed to get tar from storage with hash {}: {}",
                                    hash,
                                    e
                                )
                            })?;

                    if tar_data.is_empty() {
                        anyhow::bail!("empty tar file received for hash {}", hash);
                    }

                    let cursor = std::io::Cursor::new(&tar_data);
                    let mut archive = tar::Archive::new(cursor);

                    for entry_result in archive.entries()? {
                        let mut entry = match entry_result {
                            Ok(e) => e,
                            Err(e) => {
                                debug!(hash = %hash, error = %e, "Warning: error reading tar entry");
                                break;
                            }
                        };

                        let entry_type = entry.header().entry_type();
                        if entry_type.is_dir() {
                            continue;
                        }

                        let path = entry.path()?.to_path_buf();
                        let mut content = Vec::new();
                        std::io::Read::read_to_end(&mut entry, &mut content)?;

                        let mode = entry.header().mode().unwrap_or(0o644);
                        let mut build_header = tar::Header::new_gnu();
                        build_header.set_path(&path)?;
                        build_header.set_size(content.len() as u64);
                        build_header.set_mode(mode);
                        build_header.set_cksum();
                        tar_builder.append(&build_header, content.as_slice())?;

                        debug!(file = %path.display(), "Added to build context");
                    }
                }
            }

            tar_builder.finish()?;
        }

        Ok(tar_buf)
    }

    pub async fn push_image(&self, image: &str, registry: Option<&RegistryDTO>) -> Result<()> {
        info!(image = %image, "Pushing image...");

        let auth = get_registry_auth(registry);

        let options = PushImageOptions {
            tag: image
                .rsplit_once(':')
                .map(|(_, t)| t.to_string())
                .unwrap_or_else(|| "latest".to_string()),
        };

        let repo = image.rsplit_once(':').map(|(r, _)| r).unwrap_or(image);

        let mut stream = self.api_client.push_image(repo, Some(options), Some(auth));

        while let Some(result) = stream.next().await {
            match result {
                Ok(info) => {
                    if let Some(ref status) = info.status {
                        debug!(status = %status, "Image push progress");
                    }
                    if let Some(ref error) = info.error {
                        return Err(anyhow::anyhow!("push error: {}", error));
                    }
                }
                Err(e) => return Err(anyhow::anyhow!("failed to push image: {}", e)),
            }
        }

        info!(image = %image, "Image pushed successfully");
        Ok(())
    }

    pub async fn tag_image(&self, source: &str, target: &str) -> Result<()> {
        info!(source = %source, target = %target, "Tagging image...");

        let last_colon = target.rfind(':');
        let (repo, tag) = match last_colon {
            Some(idx) => {
                let r = &target[..idx];
                let t = &target[idx + 1..];
                if r.is_empty() || t.is_empty() {
                    anyhow::bail!("invalid target image format: {}", target);
                }
                (r, t)
            }
            None => anyhow::bail!("invalid target image format: {}", target),
        };

        self.api_client
            .tag_image(
                source,
                Some(TagImageOptions {
                    repo: repo.to_string(),
                    tag: tag.to_string(),
                }),
            )
            .await
            .map_err(|e| anyhow::anyhow!("failed to tag image: {}", e))?;

        info!(source = %source, target = %target, "Image tagged successfully");
        Ok(())
    }

    /// Get detailed information about an image
    pub async fn get_image_info(&self, image: &str) -> Result<ImageInfo> {
        let inspect = self.api_client.inspect_image(image).await?;

        // Extract digest from RepoDigests instead of using ID
        let mut hash = inspect.id.clone().unwrap_or_default();
        if let Some(ref repo_digests) = inspect.repo_digests {
            for repo_digest in repo_digests {
                if let Some(digest_part) = repo_digest.split('@').nth(1) {
                    hash = digest_part.to_string();
                    break;
                }
            }
        }

        Ok(ImageInfo {
            size: inspect.size.unwrap_or(0),
            entrypoint: inspect.config.as_ref().and_then(|c| c.entrypoint.clone()),
            cmd: inspect.config.as_ref().and_then(|c| c.cmd.clone()),
            hash,
        })
    }

    pub async fn image_exists(&self, image: &str, include_latest: bool) -> Result<bool> {
        let image_name = image.replace("docker.io/", "");

        if image_name.ends_with(":latest") && !include_latest {
            return Ok(false);
        }

        let images = self
            .api_client
            .list_images(Some(ListImagesOptions::<String> {
                all: false,
                ..Default::default()
            }))
            .await
            .map_err(|e| anyhow::anyhow!("failed to list images: {}", e))?;

        let image_with_latest = if !image_name.contains(':') {
            format!("{image_name}:latest")
        } else {
            image_name.clone()
        };

        for img in &images {
            for tag in &img.repo_tags {
                if *tag == image_with_latest || *tag == image_name {
                    info!(image = %image_name, "Image already exists");
                    return Ok(true);
                }
            }

            for digest in &img.repo_digests {
                if digest.starts_with(&image_name)
                    || image_name
                        .strip_prefix("library/")
                        .is_some_and(|stripped| digest.ends_with(stripped))
                {
                    info!(image = %image_name, "Image already exists (matched by digest)");
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    pub async fn remove_image(&self, image: &str, force: bool) -> Result<()> {
        match self
            .api_client
            .remove_image(
                image,
                Some(RemoveImageOptions {
                    force,
                    noprune: false,
                }),
                None,
            )
            .await
        {
            Ok(_) => {
                info!(image = %image, "Image deleted successfully");
                Ok(())
            }
            Err(e) if super::is_docker_not_found(&e) => {
                info!(image = %image, "Image already removed and not found");
                Ok(())
            }
            Err(e) => Err(anyhow::anyhow!("failed to remove image: {}", e)),
        }
    }
}

pub struct ImageInfo {
    pub size: i64,
    pub entrypoint: Option<Vec<String>>,
    pub cmd: Option<Vec<String>>,
    pub hash: String,
}

fn get_registry_auth(registry: Option<&RegistryDTO>) -> bollard::auth::DockerCredentials {
    match registry {
        Some(reg) => bollard::auth::DockerCredentials {
            username: Some(reg.username.clone()),
            password: Some(reg.password.clone()),
            ..Default::default()
        },
        None => bollard::auth::DockerCredentials::default(),
    }
}
