// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
#[allow(unused_imports)]
use serde_json::json;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::{BuildInfo, Sandbox};
use snapflow_models::{BackupState, SandboxClass, SandboxDesiredState, SandboxState};

use super::build_info::BuildInfoDto;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SandboxBucketRef {
    #[schema(example = "bucket123")]
    pub bucket_id: String,
    #[schema(example = "/data")]
    pub mount_path: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(as = Sandbox)]
#[serde(rename_all = "camelCase")]
pub struct SandboxDto {
    #[schema(example = "sandbox123")]
    pub id: Uuid,
    #[schema(example = "organization123")]
    pub organization_id: Uuid,
    #[schema(example = "snapflowio/sandbox:latest")]
    pub image: Option<String>,
    #[schema(example = "snapflow")]
    pub user: String,
    #[schema(example = json!({"NODE_ENV": "production"}))]
    pub env: HashMap<String, String>,
    #[schema(example = json!({"snapflow.io/public": "true"}))]
    pub labels: HashMap<String, String>,
    #[schema(example = false)]
    pub public: bool,
    #[schema(example = false)]
    pub network_block_all: bool,
    #[schema(example = "10.0.0.0/8,172.16.0.0/12")]
    pub network_allow_list: Option<String>,
    #[schema(example = "local")]
    pub target: String,
    #[schema(example = 2)]
    pub cpu: i32,
    #[schema(example = 0)]
    pub gpu: i32,
    #[schema(example = 4)]
    pub memory: i32,
    #[schema(example = 10)]
    pub disk: i32,
    pub state: Option<SandboxState>,
    pub desired_state: Option<SandboxDesiredState>,
    #[schema(example = "The sandbox is not running")]
    pub error_reason: Option<String>,
    #[schema(example = 30)]
    pub auto_stop_interval: Option<i32>,
    #[schema(example = 30)]
    pub auto_delete_interval: Option<i32>,
    #[schema(example = "executor.example.com")]
    pub executor_domain: Option<String>,
    pub buckets: Option<Vec<SandboxBucketRef>>,
    pub build_info: Option<BuildInfoDto>,
    #[deprecated]
    pub class: Option<SandboxClass>,
    pub backup_state: Option<BackupState>,
    #[schema(example = "2024-10-01T12:00:00Z")]
    pub backup_created_at: Option<DateTime<Utc>>,
    #[schema(example = "1.0.0")]
    pub node_version: Option<String>,
    #[schema(example = "https://proxy.example.com/toolbox")]
    pub toolbox_proxy_url: Option<String>,
    #[schema(example = "2024-10-01T12:00:00Z")]
    pub created_at: Option<DateTime<Utc>>,
    #[schema(example = "2024-10-01T12:00:00Z")]
    pub updated_at: Option<DateTime<Utc>>,
}

impl SandboxDto {
    pub fn from_sandbox(
        sandbox: &Sandbox,
        executor_domain: Option<String>,
        build_info: Option<&BuildInfo>,
        toolbox_base_url: &str,
    ) -> Self {
        let env = serde_json::from_value(sandbox.env.clone()).unwrap_or_default();

        let labels = sandbox
            .labels
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        let buckets: Vec<SandboxBucketRef> =
            serde_json::from_value(sandbox.buckets.clone()).unwrap_or_default();

        let state = Self::resolve_state(sandbox.state, sandbox.desired_state);

        let auto_stop = if sandbox.auto_stop_interval > 0 {
            Some(sandbox.auto_stop_interval)
        } else {
            None
        };
        let auto_delete = if sandbox.auto_delete_interval > 0 {
            Some(sandbox.auto_delete_interval)
        } else {
            None
        };

        #[allow(deprecated)]
        Self {
            id: sandbox.id,
            organization_id: sandbox.organization_id,
            target: sandbox.region.clone(),
            image: sandbox.image.clone(),
            user: sandbox.os_user.clone(),
            env,
            cpu: sandbox.cpu,
            gpu: sandbox.gpu,
            memory: sandbox.mem,
            disk: sandbox.disk,
            public: sandbox.public,
            network_block_all: sandbox.network_block_all,
            network_allow_list: sandbox.network_allow_list.clone(),
            labels,
            buckets: Some(buckets),
            state: Some(state),
            desired_state: Some(sandbox.desired_state),
            error_reason: sandbox.error_reason.clone(),
            auto_stop_interval: auto_stop,
            auto_delete_interval: auto_delete,
            class: Some(sandbox.class),
            created_at: Some(sandbox.created_at),
            updated_at: Some(sandbox.updated_at),
            build_info: build_info.map(BuildInfoDto::from),
            executor_domain,
            backup_state: Some(sandbox.backup_state),
            backup_created_at: sandbox.last_backup_at,
            node_version: sandbox.node_version.clone(),
            toolbox_proxy_url: Some(format!("{toolbox_base_url}/{}", sandbox.id)),
        }
    }

    fn resolve_state(state: SandboxState, desired: SandboxDesiredState) -> SandboxState {
        match (state, desired) {
            (SandboxState::Started, SandboxDesiredState::Stopped) => SandboxState::Stopping,
            (SandboxState::Started, SandboxDesiredState::Destroyed) => SandboxState::Destroying,
            (SandboxState::Stopped, SandboxDesiredState::Started) => SandboxState::Starting,
            (SandboxState::Stopped, SandboxDesiredState::Destroyed) => SandboxState::Destroying,
            (SandboxState::Unknown, SandboxDesiredState::Started) => SandboxState::Creating,
            (s, _) => s,
        }
    }
}
