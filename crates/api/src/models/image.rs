// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use snapflow_models::ImageState;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Image {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub general: bool,
    pub name: String,
    pub image_name: String,
    pub internal_name: Option<String>,
    /// Content-addressable hash for deduplication across registries.
    pub reference_hash: Option<String>,
    pub state: ImageState,
    pub error_reason: Option<String>,
    pub size: Option<f32>,
    pub cpu: i32,
    pub gpu: i32,
    pub mem: i32,
    pub disk: i32,
    pub hide_from_users: bool,
    pub entrypoint: Option<Vec<String>>,
    pub cmd: Option<Vec<String>>,
    pub build_info_image_ref: Option<String>,
    pub build_executor_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}
