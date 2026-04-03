// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::time::Duration;

use bollard::Docker;
use bollard::auth::DockerCredentials;
use bollard::container::{
    Config, CreateContainerOptions, InspectContainerOptions, RemoveContainerOptions,
};
use bollard::image::{CreateImageOptions, PushImageOptions, RemoveImageOptions, TagImageOptions};
use futures_util::StreamExt;
use tokio::time::sleep;

use crate::models::Registry;
use snapflow_errors::{AppError, Result};

pub struct DockerClient {
    docker: Docker,
    binary_path: Option<String>,
}

impl DockerClient {
    pub fn new(docker_host: Option<&str>, binary_path: Option<String>) -> Result<Self> {
        let docker = if let Some(host) = docker_host {
            Docker::connect_with_http(host, 120, bollard::API_DEFAULT_VERSION)
                .map_err(|e| AppError::Internal(format!("failed to connect to docker: {e}")))?
        } else {
            Docker::connect_with_local_defaults()
                .map_err(|e| AppError::Internal(format!("failed to connect to docker: {e}")))?
        };

        tracing::info!("docker client initialized");

        Ok(Self {
            docker,
            binary_path,
        })
    }

    pub async fn container_exists(&self, container_id: &str) -> bool {
        self.docker
            .inspect_container(container_id, None::<InspectContainerOptions>)
            .await
            .is_ok()
    }

    pub async fn create_container(
        &self,
        image_name: &str,
        entrypoint: Option<Vec<String>>,
    ) -> Result<String> {
        self.validate_image_architecture(image_name).await?;

        let env = vec![
            "SNAPFLOW_SANDBOX_ID=init-image".to_string(),
            "SNAPFLOW_SANDBOX_USER=root".to_string(),
            format!("SNAPFLOW_SANDBOX_SNAPSHOT={image_name}"),
        ];

        let mut binds = Vec::default();
        if let Some(ref path) = self.binary_path {
            binds.push(format!("{path}:/usr/local/bin/snapflow:ro"));
        }

        let host_config = bollard::models::HostConfig {
            binds: if binds.is_empty() { None } else { Some(binds) },
            ..Default::default()
        };

        let config = Config::<String> {
            image: Some(image_name.to_string()),
            env: Some(env),
            entrypoint: entrypoint.clone(),
            host_config: Some(host_config),
            ..Default::default()
        };

        let response = self
            .docker
            .create_container(None::<CreateContainerOptions<String>>, config)
            .await
            .map_err(|e| AppError::Internal(format!("failed to create container: {e}")))?;

        self.docker
            .start_container::<String>(&response.id, None)
            .await
            .map_err(|e| AppError::Internal(format!("failed to start container: {e}")))?;

        Ok(response.id)
    }

    pub async fn remove_container(&self, container_id: &str) -> Result<()> {
        match self
            .docker
            .remove_container(
                container_id,
                Some(RemoveContainerOptions {
                    force: true,
                    ..Default::default()
                }),
            )
            .await
        {
            Ok(_)
            | Err(bollard::errors::Error::DockerResponseServerError {
                status_code: 404, ..
            }) => Ok(()),
            Err(e) => {
                tracing::error!(container_id, error = %e, "failed to remove container");
                Err(AppError::Internal(format!(
                    "failed to remove container: {e}"
                )))
            }
        }
    }

    pub async fn is_running(&self, container_id: &str) -> bool {
        if container_id.is_empty() {
            return false;
        }

        match self
            .docker
            .inspect_container(container_id, None::<InspectContainerOptions>)
            .await
        {
            Ok(info) => info.state.and_then(|s| s.running).unwrap_or(false),
            Err(_) => false,
        }
    }

    pub async fn is_destroyed(&self, container_id: &str) -> bool {
        !self.container_exists(container_id).await
    }

    pub async fn start_container(&self, container_id: &str) -> Result<()> {
        self.docker
            .start_container::<String>(container_id, None)
            .await
            .map_err(|e| AppError::Internal(format!("failed to start container: {e}")))
    }

    pub async fn stop_container(&self, container_id: &str) -> Result<()> {
        self.docker
            .stop_container(container_id, None)
            .await
            .map_err(|e| AppError::Internal(format!("failed to stop container: {e}")))
    }

    pub async fn image_exists(&self, image: &str) -> bool {
        let image = image.trim_start_matches("docker.io/");

        if image.ends_with(":latest") {
            return false;
        }

        self.docker.inspect_image(image).await.is_ok()
    }

    pub async fn validate_image_architecture(&self, image: &str) -> Result<()> {
        let image = image.trim_start_matches("docker.io/");

        let info = self
            .docker
            .inspect_image(image)
            .await
            .map_err(|e| AppError::Internal(format!("failed to inspect image: {e}")))?;

        let arch = info.architecture.unwrap_or_default().to_lowercase();
        if arch != "amd64" && arch != "x86_64" {
            return Err(AppError::BadRequest(format!(
                "image architecture '{arch}' is not supported, only amd64/x86_64"
            )));
        }

        Ok(())
    }

    pub async fn get_image_entrypoint(&self, image: &str) -> Result<Option<Vec<String>>> {
        let info = self
            .docker
            .inspect_image(image)
            .await
            .map_err(|e| AppError::Internal(format!("failed to inspect image: {e}")))?;

        Ok(info
            .config
            .and_then(|c| c.entrypoint)
            .filter(|e| !e.is_empty()))
    }

    pub async fn get_image_info(&self, image: &str) -> Result<ImageInfo> {
        let info = self
            .docker
            .inspect_image(image)
            .await
            .map_err(|e| AppError::Internal(format!("failed to get image info: {e}")))?;

        #[allow(clippy::cast_precision_loss)]
        let size_gb = info.size.unwrap_or(0) as f64 / (1024.0 * 1024.0 * 1024.0);
        let entrypoint = info
            .config
            .and_then(|c| c.entrypoint)
            .filter(|e| !e.is_empty());

        Ok(ImageInfo {
            size_gb,
            entrypoint,
        })
    }

    pub async fn remove_image(&self, image: &str) -> Result<()> {
        self.docker
            .remove_image(image, None::<RemoveImageOptions>, None)
            .await
            .map_err(|e| AppError::Internal(format!("failed to remove image: {e}")))?;
        Ok(())
    }

    pub async fn tag_image(&self, source: &str, target: &str) -> Result<()> {
        let (repo, tag) = target.rsplit_once(':').ok_or_else(|| {
            AppError::BadRequest("invalid target image format, expected repo:tag".into())
        })?;

        if repo.is_empty() || tag.is_empty() {
            return Err(AppError::BadRequest(
                "invalid target image format, repo and tag must be non-empty".into(),
            ));
        }

        self.docker
            .tag_image(source, Some(TagImageOptions { repo, tag }))
            .await
            .map_err(|e| AppError::Internal(format!("failed to tag image: {e}")))
    }

    pub async fn prune_images(&self) -> Result<()> {
        let mut filters = HashMap::default();
        filters.insert("dangling", vec!["true"]);

        match self
            .docker
            .prune_images(Some(bollard::image::PruneImagesOptions { filters }))
            .await
        {
            Ok(_)
            | Err(bollard::errors::Error::DockerResponseServerError {
                status_code: 409, ..
            }) => Ok(()),
            Err(e) => Err(AppError::Internal(format!("failed to prune images: {e}"))),
        }
    }

    pub async fn pull_image(&self, image: &str, registry: Option<&Registry>) -> Result<()> {
        retry(3, Duration::from_secs(1), || async {
            self.pull_image_inner(image, registry).await
        })
        .await?;

        self.validate_image_architecture(image).await
    }

    async fn pull_image_inner(&self, image: &str, registry: Option<&Registry>) -> Result<()> {
        let credentials = registry.map(|r| DockerCredentials {
            username: Some(r.username.clone()),
            password: Some(r.password.clone()),
            serveraddress: Some(r.url.clone()),
            ..Default::default()
        });

        let options = CreateImageOptions {
            from_image: image,
            platform: "linux/amd64",
            ..Default::default()
        };

        let mut stream = self.docker.create_image(Some(options), None, credentials);

        while let Some(result) = stream.next().await {
            match result {
                Ok(_) => {}
                Err(bollard::errors::Error::DockerResponseServerError {
                    status_code: 404,
                    message,
                }) => {
                    if message.contains("pull access denied")
                        || message.contains("no basic auth credentials")
                    {
                        return Err(AppError::BadRequest(
                            "repository does not exist or may require container registry login credentials".into(),
                        ));
                    }
                    return Err(AppError::Internal(format!(
                        "failed to pull image: {message}"
                    )));
                }
                Err(e) => {
                    return Err(AppError::Internal(format!("failed to pull image: {e}")));
                }
            }
        }

        Ok(())
    }

    pub async fn push_image(&self, image: &str, registry: &Registry) -> Result<()> {
        retry(3, Duration::from_secs(1), || async {
            self.push_image_inner(image, registry).await
        })
        .await
    }

    async fn push_image_inner(&self, image: &str, registry: &Registry) -> Result<()> {
        let (repo, tag) = image.rsplit_once(':').unwrap_or((image, "latest"));

        let credentials = DockerCredentials {
            username: Some(registry.username.clone()),
            password: Some(registry.password.clone()),
            serveraddress: Some(registry.url.clone()),
            ..Default::default()
        };

        let options = PushImageOptions { tag };

        let mut stream = self
            .docker
            .push_image(repo, Some(options), Some(credentials));

        while let Some(result) = stream.next().await {
            match result {
                Ok(output) => {
                    if let Some(error) = output.error {
                        return Err(AppError::Internal(format!("failed to push image: {error}")));
                    }
                }
                Err(e) => {
                    return Err(AppError::Internal(format!("failed to push image: {e}")));
                }
            }
        }

        Ok(())
    }

    pub async fn check_image_exists_in_registry(
        &self,
        image_name: &str,
        registry: &Registry,
        registry_url: &str,
    ) -> bool {
        let (name, tag) = image_name
            .rsplit_once(':')
            .unwrap_or((image_name, "latest"));
        let parts: Vec<&str> = name.split('/').collect();

        if parts.len() < 3 {
            tracing::warn!(image_name, "invalid image name format for registry check");
            return false;
        }

        let manifest_url = format!(
            "{}/v2/{}/{}/manifests/{}",
            registry_url, parts[1], parts[2], tag
        );

        let client = reqwest::Client::default();
        match client
            .head(&manifest_url)
            .basic_auth(&registry.username, Some(&registry.password))
            .timeout(Duration::from_secs(30))
            .send()
            .await
        {
            Ok(resp) => resp.status().is_success(),
            Err(e) => {
                tracing::warn!(image_name, error = %e, "failed to check image in registry");
                false
            }
        }
    }
}

pub struct ImageInfo {
    pub size_gb: f64,
    pub entrypoint: Option<Vec<String>>,
}

async fn retry<F, Fut, T>(max_attempts: u32, initial_delay: Duration, operation: F) -> Result<T>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let mut delay = initial_delay;

    for attempt in 1..=max_attempts {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) if attempt == max_attempts => return Err(e),
            Err(e) => {
                tracing::warn!(
                    attempt,
                    max_attempts,
                    delay_ms = u64::try_from(delay.as_millis()).unwrap_or(u64::MAX),
                    error = %e,
                    "operation failed, retrying"
                );
                sleep(delay).await;
                delay *= 2;
            }
        }
    }

    unreachable!()
}
