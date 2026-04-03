// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use snapflow_models::{ExecutorState, SandboxClass};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Executor {
    pub id: Uuid,
    pub domain: String,
    pub api_url: String,
    pub proxy_url: String,
    pub api_key: String,
    pub cpu: i32,
    pub memory_gib: i32,
    pub disk_gib: i32,
    pub gpu: i32,
    pub gpu_type: String,
    pub class: SandboxClass,
    pub used: i32,
    pub capacity: i32,
    pub current_cpu_usage_percentage: f32,
    pub current_memory_usage_percentage: f32,
    pub current_disk_usage_percentage: f32,
    pub current_allocated_cpu: i32,
    pub current_allocated_memory_gib: i32,
    pub current_allocated_disk_gib: i32,
    pub current_image_count: i32,
    pub availability_score: i32,
    pub region: String,
    pub state: ExecutorState,
    pub version: String,
    pub last_checked: Option<DateTime<Utc>>,
    pub unschedulable: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
