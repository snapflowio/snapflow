// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod database;
pub mod docker;
pub mod lock;
pub mod pending_usage;
pub mod redis;

use std::collections::HashSet;
use std::sync::Arc;

use sqlx::PgPool;
use tokio::sync::Mutex;
use tokio_util::task::TaskTracker;
use uuid::Uuid;

use crate::config::AppConfig;
use crate::events::EventBus;
use crate::mail::client::MailClient;
use crate::realtime::Realtime;
use crate::services::storage::StorageClient;
use snapflow_auth::jwt::JwtKeys;
use snapflow_errors::{AppError, Result};

use self::docker::DockerClient;
use self::lock::RedisLock;

#[derive(Clone)]
pub struct Infra {
    pub pool: PgPool,
    pub config: Arc<AppConfig>,
    pub jwt: Arc<JwtKeys>,
    pub lock: RedisLock,
    pub redis: ::redis::aio::ConnectionManager,
    pub realtime: Realtime,
    pub events: EventBus,
    pub http_client: reqwest::Client,
    pub mail: Arc<MailClient>,
    pub storage: Option<Arc<StorageClient>>,
    pub docker: Option<Arc<DockerClient>>,
    pub task_tracker: TaskTracker,
    pub bucket_processing: Arc<Mutex<HashSet<Uuid>>>,
}

impl Infra {
    pub fn require_storage(&self) -> Result<&Arc<StorageClient>> {
        self.storage.as_ref().ok_or(AppError::ServiceUnavailable(
            "storage not configured".into(),
        ))
    }

    pub fn require_docker(&self) -> Result<&Arc<DockerClient>> {
        self.docker
            .as_ref()
            .ok_or(AppError::ServiceUnavailable("docker not configured".into()))
    }

    pub fn toolbox_base_url(&self) -> String {
        format!("{}/toolbox", self.config.proxy.base_url())
    }
}
