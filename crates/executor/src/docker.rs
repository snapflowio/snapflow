// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod backup;
pub mod bucket;
pub mod commit;
pub mod config;
pub mod create;
pub mod destroy;
pub mod exec;
pub mod image;
pub mod monitor;
pub mod node;
pub mod resize;
pub mod start;
pub mod state;
pub mod stop;

use std::collections::HashMap;
use std::future::Future;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use bollard::container::ListContainersOptions;
use dashmap::DashMap;
use tokio::sync::{Mutex, OnceCell, Semaphore};
use tokio_util::sync::CancellationToken;

use crate::cache::ExecutorCache;
use crate::netrules::NetRulesManager;

pub fn is_docker_not_found(err: &bollard::errors::Error) -> bool {
    matches!(
        err,
        bollard::errors::Error::DockerResponseServerError {
            status_code: 404,
            ..
        }
    )
}

pub const NODE_PORT: u16 = 8082;
pub const MAX_CONCURRENT_BACKUPS: usize = 3;
pub const DEFAULT_MAX_RETRIES: u32 = 5;
pub const DEFAULT_BASE_DELAY: Duration = Duration::from_millis(100);
pub const DEFAULT_MAX_DELAY: Duration = Duration::from_secs(5);

pub struct DockerClientConfig {
    pub api_client: bollard::Docker,
    pub cache: Arc<ExecutorCache>,
    pub r2_region: String,
    pub r2_endpoint_url: String,
    pub r2_access_key_id: String,
    pub r2_secret_access_key: String,
    pub node_path: PathBuf,
    pub environment: String,
    pub container_runtime: Option<String>,
    pub container_network: Option<String>,
    pub cancel_token: CancellationToken,
    pub net_rules_manager: Arc<NetRulesManager>,
    pub resource_limits_disabled: bool,
}

pub struct DockerClient {
    pub(crate) api_client: bollard::Docker,
    pub(crate) cache: Arc<ExecutorCache>,
    pub(crate) r2_region: String,
    pub(crate) r2_endpoint_url: String,
    r2_access_key_id: String,
    r2_secret_access_key: String,
    pub(crate) node_path: PathBuf,
    pub(crate) bucket_mutexes: DashMap<String, Arc<Mutex<()>>>,
    pub(crate) backup_tokens: DashMap<String, CancellationToken>,
    pub(crate) backup_semaphore: Arc<Semaphore>,
    pub(crate) environment: String,
    pub(crate) container_runtime: Option<String>,
    pub(crate) container_network: Option<String>,
    pub(crate) cancel_token: CancellationToken,
    pub(crate) net_rules_manager: Arc<NetRulesManager>,
    pub(crate) resource_limits_disabled: bool,
    filesystem: OnceCell<Option<String>>,
}

impl std::fmt::Debug for DockerClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DockerClient")
            .field("r2_region", &self.r2_region)
            .field("r2_endpoint_url", &self.r2_endpoint_url)
            .field("r2_access_key_id", &"[REDACTED]")
            .field("r2_secret_access_key", &"[REDACTED]")
            .field("environment", &self.environment)
            .finish()
    }
}

impl DockerClient {
    pub fn new(config: DockerClientConfig) -> Self {
        Self {
            api_client: config.api_client,
            cache: config.cache,
            r2_region: config.r2_region,
            r2_endpoint_url: config.r2_endpoint_url,
            r2_access_key_id: config.r2_access_key_id,
            r2_secret_access_key: config.r2_secret_access_key,
            node_path: config.node_path,
            bucket_mutexes: DashMap::default(),
            backup_tokens: DashMap::default(),
            backup_semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_BACKUPS)),
            environment: config.environment,
            container_runtime: config.container_runtime,
            container_network: config.container_network,
            cancel_token: config.cancel_token,
            net_rules_manager: config.net_rules_manager,
            resource_limits_disabled: config.resource_limits_disabled,
            filesystem: OnceCell::default(),
        }
    }

    pub async fn cached_filesystem(&self) -> Result<Option<String>> {
        self.filesystem
            .get_or_try_init(|| async {
                let info = self
                    .api_client
                    .info()
                    .await
                    .map_err(|e| anyhow::anyhow!("failed to get Docker info: {}", e))?;

                if let Some(ref driver_status) = info.driver_status {
                    for pair in driver_status {
                        if let [key, value, ..] = pair.as_slice() {
                            if key == "Backing Filesystem" {
                                return Ok(Some(value.clone()));
                            }
                        }
                    }
                }

                Ok(None)
            })
            .await
            .cloned()
    }

    pub fn is_development(&self) -> bool {
        self.environment == "development"
    }

    pub fn api_client(&self) -> &bollard::Docker {
        &self.api_client
    }

    pub async fn list_snapflow_containers(&self) -> Result<Vec<bollard::models::ContainerSummary>> {
        let mut filters = HashMap::default();
        filters.insert(
            "label".to_owned(),
            vec!["snapflow.meta.organizationId".to_owned()],
        );

        let options = ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        };

        self.api_client
            .list_containers(Some(options))
            .await
            .map_err(|e| anyhow::anyhow!("failed to list containers: {e}"))
    }

    pub async fn retry_with_backoff<F, Fut>(
        &self,
        operation_name: &str,
        container_id: &str,
        max_retries: u32,
        base_delay: Duration,
        max_delay: Duration,
        operation_fn: F,
    ) -> Result<()>
    where
        F: Fn() -> Fut,
        Fut: Future<Output = Result<()>>,
    {
        let max_retries = if max_retries <= 1 {
            DEFAULT_MAX_RETRIES
        } else {
            max_retries
        };

        let mut last_err = None;

        for attempt in 0..max_retries {
            match operation_fn().await {
                Ok(()) => return Ok(()),
                Err(err) => {
                    if attempt < max_retries - 1 {
                        let delay = base_delay.saturating_mul(1 << attempt).min(max_delay);

                        tracing::warn!(
                            "Failed to {} sandbox {} (attempt {}/{}): {}. Retrying in {:?}...",
                            operation_name,
                            container_id,
                            attempt + 1,
                            max_retries,
                            err,
                            delay,
                        );

                        tokio::select! {
                            _ = tokio::time::sleep(delay) => continue,
                            _ = self.cancel_token.cancelled() => {
                                tracing::debug!(
                                    "Retry cancelled for {} sandbox {}",
                                    operation_name,
                                    container_id,
                                );
                                return Err(anyhow::anyhow!("operation cancelled"));
                            }
                        }
                    }

                    last_err = Some(err);
                }
            }
        }

        Err(anyhow::anyhow!(
            "failed to {} sandbox after {} attempts: {}",
            operation_name,
            max_retries,
            last_err.as_ref().map(|e| e.to_string()).unwrap_or_default(),
        ))
    }
}
