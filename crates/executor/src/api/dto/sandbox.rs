// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;
use validator::Validate;

use super::registry::RegistryDTO;
use super::volume::BucketDTO;
use crate::models::{BackupState, SandboxState};

#[derive(Debug, Clone, Deserialize, ToSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct CreateSandboxDTO {
    #[validate(length(min = 1))]
    pub id: String,
    #[validate(length(min = 1))]
    pub user_id: String,
    #[validate(length(min = 1))]
    pub image: String,
    #[validate(length(min = 1))]
    pub os_user: String,
    #[validate(range(min = 1))]
    #[schema(minimum = 1)]
    pub cpu_quota: i32,
    #[validate(range(min = 0))]
    #[schema(minimum = 0)]
    pub gpu_quota: Option<i32>,
    #[validate(range(min = 1))]
    #[schema(minimum = 1)]
    pub memory_quota: i32,
    #[validate(range(min = 1))]
    #[schema(minimum = 1)]
    pub storage_quota: i32,
    pub env: Option<HashMap<String, String>>,
    pub registry: Option<RegistryDTO>,
    pub entrypoint: Option<Vec<String>>,
    pub buckets: Option<Vec<BucketDTO>>,
    pub labels: Option<HashMap<String, String>>,
    pub metadata: Option<HashMap<String, String>>,
    pub network_block_all: Option<bool>,
    pub network_allow_list: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize, ToSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ResizeSandboxDTO {
    #[validate(range(min = 1))]
    #[schema(minimum = 1)]
    pub cpu: i32,
    #[validate(range(min = 0))]
    #[schema(minimum = 0)]
    pub gpu: Option<i32>,
    #[validate(range(min = 1))]
    #[schema(minimum = 1)]
    pub memory: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SandboxInfoResponse {
    pub state: SandboxState,
    pub backup_state: BackupState,
    pub backup_error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNetworkSettingsDTO {
    pub network_block_all: Option<bool>,
    pub network_allow_list: Option<String>,
    pub network_limit_egress: Option<bool>,
}
