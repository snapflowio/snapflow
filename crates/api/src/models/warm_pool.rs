// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use snapflow_models::SandboxClass;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WarmPool {
    pub id: Uuid,
    pub pool: i32,
    pub image: String,
    pub target: String,
    pub cpu: i32,
    pub mem: i32,
    pub disk: i32,
    pub gpu: i32,
    pub gpu_type: String,
    pub class: SandboxClass,
    pub os_user: String,
    pub error_reason: Option<String>,
    pub env: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
