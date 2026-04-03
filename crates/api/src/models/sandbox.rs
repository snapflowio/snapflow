// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use snapflow_models::{BackupState, SandboxClass, SandboxDesiredState, SandboxState};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Sandbox {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub region: String,
    pub executor_id: Option<Uuid>,
    pub prev_executor_id: Option<Uuid>,
    pub class: SandboxClass,
    pub state: SandboxState,
    pub desired_state: SandboxDesiredState,
    pub image: Option<String>,
    pub os_user: String,
    pub error_reason: Option<String>,
    pub env: serde_json::Value,
    pub public: bool,
    pub labels: Option<serde_json::Value>,
    pub cpu: i32,
    pub gpu: i32,
    pub mem: i32,
    pub disk: i32,
    pub buckets: serde_json::Value,
    pub auto_stop_interval: i32,
    pub auto_archive_interval: i32,
    pub auto_delete_interval: i32,
    pub pending: bool,
    pub auth_token: String,
    pub build_info_image_ref: Option<String>,
    pub node_version: Option<String>,
    pub network_block_all: bool,
    pub network_allow_list: Option<String>,
    pub backup_state: BackupState,
    pub backup_snapshot: Option<String>,
    pub backup_registry_id: Option<Uuid>,
    pub backup_error_reason: Option<String>,
    pub existing_backup_snapshots: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_activity_at: Option<DateTime<Utc>>,
    pub last_backup_at: Option<DateTime<Utc>>,
}
