// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub created_by: Uuid,
    pub personal: bool,
    pub telemetry_enabled: bool,
    pub total_cpu_quota: i32,
    pub total_memory_quota: i32,
    pub total_disk_quota: i32,
    pub max_cpu_per_sandbox: i32,
    pub max_memory_per_sandbox: i32,
    pub max_disk_per_sandbox: i32,
    pub max_image_size: i32,
    pub image_quota: i32,
    pub bucket_quota: i32,
    pub wallet_balance: f64,
    pub suspended: bool,
    pub suspended_at: Option<DateTime<Utc>>,
    pub suspension_reason: Option<String>,
    pub suspended_until: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
