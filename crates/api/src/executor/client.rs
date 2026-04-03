// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::time::Duration;

use anyhow::anyhow;
use async_trait::async_trait;
use backon::{ExponentialBuilder, Retryable};
use serde::Deserialize;
use snapflow_executor_client::apis::configuration::Configuration;
use snapflow_executor_client::apis::{images_api, info_api, sandbox_api};
use snapflow_executor_client::models::{
    BackupState as RemoteBackupState, BucketDto, BuildImageRequestDto, CreateBackupDto,
    CreateSandboxDto, PullImageRequestDto, RegistryDto, ResizeSandboxDto, SandboxInfoResponse,
    SandboxState as RemoteSandboxState,
};
use tracing::warn;

use super::adapter::{ExecutorAdapter, ExecutorInfo, ExecutorMetrics, ExecutorSandboxInfo};
use crate::constants::executor::{RETRY_MAX_TIMES, SHORT_REQUEST_TIMEOUT};
use crate::models::{BuildInfo, Executor, Registry, Sandbox};
use snapflow_errors::AppError;
use snapflow_models::{BackupState, SandboxState};

pub struct ExecutorClient {
    config: Configuration,
    base_url: String,
    auth_header: String,
}

#[derive(Deserialize)]
struct NodeVersionResponse {
    version: String,
}

impl ExecutorClient {
    pub fn new(executor: &Executor) -> Result<Self, AppError> {
        let auth_header = format!("Bearer {}", executor.api_key);

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(3600))
            .default_headers({
                let mut headers = reqwest::header::HeaderMap::default();
                headers.insert(
                    reqwest::header::AUTHORIZATION,
                    auth_header.parse().map_err(|_| {
                        AppError::BadRequest("invalid executor api key header value".into())
                    })?,
                );
                headers
            })
            .build()
            .map_err(|e| AppError::Internal(format!("failed to build HTTP client: {e}")))?;

        let config = Configuration {
            base_path: executor.api_url.clone(),
            client,
            user_agent: None,
            basic_auth: None,
            oauth_access_token: None,
            bearer_access_token: None,
            api_key: None,
        };

        Ok(Self {
            config,
            base_url: executor.api_url.clone(),
            auth_header,
        })
    }

    fn convert_sandbox_state(state: RemoteSandboxState) -> SandboxState {
        match state {
            RemoteSandboxState::Creating => SandboxState::Creating,
            RemoteSandboxState::Destroyed => SandboxState::Destroyed,
            RemoteSandboxState::Destroying => SandboxState::Destroying,
            RemoteSandboxState::Started => SandboxState::Started,
            RemoteSandboxState::Stopped => SandboxState::Stopped,
            RemoteSandboxState::Starting => SandboxState::Starting,
            RemoteSandboxState::Stopping => SandboxState::Stopping,
            RemoteSandboxState::Error => SandboxState::Error,
            RemoteSandboxState::PullingImage => SandboxState::PullingImage,
            _ => SandboxState::Unknown,
        }
    }

    fn convert_backup_state(state: RemoteBackupState) -> BackupState {
        match state {
            RemoteBackupState::None => BackupState::None,
            RemoteBackupState::Pending => BackupState::Pending,
            RemoteBackupState::InProgress => BackupState::InProgress,
            RemoteBackupState::Completed => BackupState::Completed,
            RemoteBackupState::Failed => BackupState::Failed,
        }
    }

    fn build_registry_dto(registry: &Registry) -> RegistryDto {
        RegistryDto {
            url: registry.url.clone(),
            username: registry.username.clone(),
            password: registry.password.clone(),
            project: Some(Some(registry.project.clone())),
        }
    }

    fn is_retryable(err: &anyhow::Error) -> bool {
        let msg = err.to_string();
        msg.contains("ECONNRESET")
            || msg.contains("connection reset")
            || msg.contains("broken pipe")
            || msg.contains("Connection reset by peer")
    }

    fn retry_policy() -> ExponentialBuilder {
        ExponentialBuilder::default().with_max_times(RETRY_MAX_TIMES)
    }

    async fn exec_retryable<F, Fut, T>(&self, op: F) -> Result<T, AppError>
    where
        F: FnMut() -> Fut + Send,
        Fut: std::future::Future<Output = anyhow::Result<T>> + Send,
        T: Send,
    {
        op.retry(Self::retry_policy())
            .when(Self::is_retryable)
            .await
            .map_err(|e| {
                let status = extract_status_code(&e);
                AppError::from_executor_error(status, e)
            })
    }
}

#[async_trait]
impl ExecutorAdapter for ExecutorClient {
    async fn health_check(&self) -> Result<(), AppError> {
        let url = format!("{}/", self.base_url);
        let auth = self.auth_header.clone();

        self.exec_retryable(|| {
            let url = url.clone();
            let auth = auth.clone();
            async move {
                let response: serde_json::Value = self
                    .config
                    .client
                    .get(&url)
                    .header(reqwest::header::AUTHORIZATION, &auth)
                    .timeout(SHORT_REQUEST_TIMEOUT)
                    .send()
                    .await?
                    .error_for_status()
                    .map_err(|e| anyhow!("{e}"))?
                    .json()
                    .await?;

                let status = response
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                if status != "ok" {
                    anyhow::bail!("executor is not healthy");
                }

                Ok(())
            }
        })
        .await
    }

    async fn executor_info(&self) -> Result<ExecutorInfo, AppError> {
        self.exec_retryable(|| async {
            let response = info_api::executor_info(&self.config)
                .await
                .map_err(|e| anyhow!("{e}"))?;

            let metrics = response.metrics.flatten().map(|m| ExecutorMetrics {
                current_allocated_cpu: m.current_allocated_cpu,
                current_allocated_disk_gib: m.current_allocated_disk_gi_b,
                current_allocated_memory_gib: m.current_allocated_memory_gi_b,
                current_cpu_usage_percentage: m.current_cpu_usage_percentage,
                current_disk_usage_percentage: m.current_disk_usage_percentage,
                current_memory_usage_percentage: m.current_memory_usage_percentage,
                current_image_count: m.current_image_count,
            });

            Ok(ExecutorInfo { metrics })
        })
        .await
    }

    async fn sandbox_info(&self, sandbox_id: &str) -> Result<ExecutorSandboxInfo, AppError> {
        let url = format!("{}/sandboxes/{}", self.base_url, sandbox_id);
        let auth = self.auth_header.clone();

        self.exec_retryable(|| {
            let url = url.clone();
            let auth = auth.clone();
            async move {
                let response: SandboxInfoResponse = self
                    .config
                    .client
                    .get(&url)
                    .header(reqwest::header::AUTHORIZATION, &auth)
                    .timeout(SHORT_REQUEST_TIMEOUT)
                    .send()
                    .await?
                    .error_for_status()
                    .map_err(|e| anyhow!("{e}"))?
                    .json()
                    .await?;

                Ok(ExecutorSandboxInfo {
                    state: Self::convert_sandbox_state(response.state),
                    backup_state: Self::convert_backup_state(response.backup_state),
                    backup_error: response.backup_error.flatten(),
                })
            }
        })
        .await
    }

    async fn create_sandbox(
        &self,
        sandbox: &Sandbox,
        registry: Option<&Registry>,
        entrypoint: Option<Vec<String>>,
    ) -> Result<(), AppError> {
        let env: HashMap<String, String> = serde_json::from_value(sandbox.env.clone())
            .unwrap_or_else(|e| {
                warn!(sandbox_id = %sandbox.id, error = %e, "failed to deserialize sandbox env");
                HashMap::default()
            });

        let buckets: Option<Vec<BucketDto>> = serde_json::from_value(sandbox.buckets.clone())
            .ok()
            .filter(|v: &Vec<BucketDto>| !v.is_empty());

        let mut dto = CreateSandboxDto::new(
            sandbox.cpu,
            sandbox.id.to_string(),
            sandbox.image.clone().unwrap_or_default(),
            sandbox.mem,
            sandbox.os_user.clone(),
            sandbox.disk,
            sandbox.organization_id.to_string(),
        );

        dto.env = if env.is_empty() { None } else { Some(env) };
        dto.buckets = buckets.map(Some);
        dto.entrypoint = entrypoint.map(Some);
        dto.registry = registry.map(|r| Some(Box::new(Self::build_registry_dto(r))));
        dto.network_block_all = Some(Some(sandbox.network_block_all));
        dto.network_allow_list = sandbox.network_allow_list.as_ref().map(|list| {
            Some(
                list.split(',')
                    .map(|s| s.trim().to_owned())
                    .filter(|s| !s.is_empty())
                    .collect(),
            )
        });

        self.exec_retryable(|| async {
            sandbox_api::create(&self.config, dto.clone())
                .await
                .map_err(|e| anyhow!("{e}"))?;
            Ok(())
        })
        .await
    }

    async fn start_sandbox(&self, sandbox_id: &str) -> Result<(), AppError> {
        let sid = sandbox_id.to_owned();
        self.exec_retryable(|| {
            let sid = sid.clone();
            async move {
                sandbox_api::start(&self.config, &sid)
                    .await
                    .map_err(|e| anyhow!("{e}"))?;
                Ok(())
            }
        })
        .await
    }

    async fn stop_sandbox(&self, sandbox_id: &str) -> Result<(), AppError> {
        let sid = sandbox_id.to_owned();
        self.exec_retryable(|| {
            let sid = sid.clone();
            async move {
                sandbox_api::stop(&self.config, &sid)
                    .await
                    .map_err(|e| anyhow!("{e}"))?;
                Ok(())
            }
        })
        .await
    }

    async fn destroy_sandbox(&self, sandbox_id: &str) -> Result<(), AppError> {
        let sid = sandbox_id.to_owned();
        self.exec_retryable(|| {
            let sid = sid.clone();
            async move {
                sandbox_api::destroy(&self.config, &sid)
                    .await
                    .map_err(|e| anyhow!("{e}"))?;
                Ok(())
            }
        })
        .await
    }

    async fn create_backup(
        &self,
        sandbox_id: &str,
        backup_image: &str,
        registry: Option<&Registry>,
    ) -> Result<(), AppError> {
        let reg = registry
            .ok_or_else(|| AppError::BadRequest("registry is required for backup".into()))?;
        let dto = CreateBackupDto::new(backup_image.to_owned(), Self::build_registry_dto(reg));
        let sid = sandbox_id.to_owned();

        self.exec_retryable(|| {
            let sid = sid.clone();
            let dto = dto.clone();
            async move {
                sandbox_api::create_backup(&self.config, &sid, dto)
                    .await
                    .map_err(|e| anyhow!("backup request failed: {e}"))?;
                Ok(())
            }
        })
        .await
    }

    async fn remove_destroyed_sandbox(&self, sandbox_id: &str) -> Result<(), AppError> {
        let sid = sandbox_id.to_owned();
        self.exec_retryable(|| {
            let sid = sid.clone();
            async move {
                sandbox_api::remove_destroyed(&self.config, &sid)
                    .await
                    .map_err(|e| anyhow!("{e}"))?;
                Ok(())
            }
        })
        .await
    }

    async fn remove_image(&self, image_name: &str) -> Result<(), AppError> {
        let name = image_name.to_owned();
        self.exec_retryable(|| {
            let name = name.clone();
            async move {
                images_api::remove_image(&self.config, &name)
                    .await
                    .map_err(|e| anyhow!("{e}"))?;
                Ok(())
            }
        })
        .await
    }

    async fn build_image(
        &self,
        build_info: &BuildInfo,
        organization_id: Option<&str>,
        registry: Option<&Registry>,
        push_to_internal_registry: Option<bool>,
    ) -> Result<(), AppError> {
        let mut dto = BuildImageRequestDto::new(
            build_info.dockerfile_content.clone().unwrap_or_default(),
            build_info.image_ref.clone(),
            organization_id.unwrap_or_default().to_string(),
        );

        dto.context = build_info.context_hashes.clone().map(Some);
        dto.push_to_internal_registry = push_to_internal_registry.map(Some);
        dto.registry = registry.map(|r| Some(Box::new(Self::build_registry_dto(r))));

        self.exec_retryable(|| async {
            images_api::build_image(&self.config, dto.clone())
                .await
                .map_err(|e| anyhow!("{e}"))?;
            Ok(())
        })
        .await
    }

    async fn pull_image(
        &self,
        image_name: &str,
        registry: Option<&Registry>,
    ) -> Result<(), AppError> {
        let mut dto = PullImageRequestDto::new(image_name.to_string());
        dto.registry = registry.map(|r| Some(Box::new(Self::build_registry_dto(r))));

        self.exec_retryable(|| async {
            images_api::pull_image(&self.config, dto.clone())
                .await
                .map_err(|e| anyhow!("{e}"))?;
            Ok(())
        })
        .await
    }

    async fn image_exists(&self, image_name: &str) -> Result<bool, AppError> {
        let name = image_name.to_owned();
        self.exec_retryable(|| {
            let name = name.clone();
            async move {
                let response = images_api::image_exists(&self.config, &name)
                    .await
                    .map_err(|e| anyhow!("{e}"))?;
                Ok(response.exists)
            }
        })
        .await
    }

    async fn get_image_logs(&self, image_ref: &str, follow: bool) -> Result<String, AppError> {
        let iref = image_ref.to_owned();
        self.exec_retryable(|| {
            let iref = iref.clone();
            async move {
                let response = images_api::get_build_logs(&self.config, &iref, Some(follow))
                    .await
                    .map_err(|e| anyhow!("{e}"))?;
                Ok(response)
            }
        })
        .await
    }

    async fn resize_sandbox(
        &self,
        sandbox_id: &str,
        cpu: i32,
        memory: i32,
    ) -> Result<(), AppError> {
        let sid = sandbox_id.to_owned();
        let dto = ResizeSandboxDto::new(cpu, memory);
        self.exec_retryable(|| {
            let sid = sid.clone();
            let dto = dto.clone();
            async move {
                sandbox_api::resize(&self.config, &sid, dto)
                    .await
                    .map_err(|e| anyhow!("{e}"))?;
                Ok(())
            }
        })
        .await
    }

    async fn get_sandbox_node_version(&self, sandbox_id: &str) -> Result<String, AppError> {
        let url = format!("{}/sandboxes/{}/toolbox/version", self.base_url, sandbox_id);
        let auth = self.auth_header.clone();

        self.exec_retryable(|| {
            let url = url.clone();
            let auth = auth.clone();
            async move {
                let response = self
                    .config
                    .client
                    .get(&url)
                    .header(reqwest::header::AUTHORIZATION, &auth)
                    .send()
                    .await?
                    .error_for_status()
                    .map_err(|e| anyhow!("{e}"))?
                    .json::<NodeVersionResponse>()
                    .await?;

                Ok(response.version)
            }
        })
        .await
    }
}

fn extract_status_code(err: &anyhow::Error) -> Option<u16> {
    let msg = err.to_string();
    for prefix in ["status: ", "HTTP "] {
        if let Some(pos) = msg.find(prefix) {
            let start = pos + prefix.len();
            let code_str: String = msg[start..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            if let Ok(code) = code_str.parse::<u16>() {
                return Some(code);
            }
        }
    }
    None
}
