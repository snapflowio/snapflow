// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::Organization;

#[derive(Serialize, ToSchema)]
#[schema(as = Organization)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationDto {
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
    pub suspended: bool,
    pub suspended_at: Option<DateTime<Utc>>,
    pub suspension_reason: Option<String>,
    pub suspended_until: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&Organization> for OrganizationDto {
    fn from(org: &Organization) -> Self {
        Self {
            id: org.id,
            name: org.name.clone(),
            created_by: org.created_by,
            personal: org.personal,
            telemetry_enabled: org.telemetry_enabled,
            total_cpu_quota: org.total_cpu_quota,
            total_memory_quota: org.total_memory_quota,
            total_disk_quota: org.total_disk_quota,
            max_cpu_per_sandbox: org.max_cpu_per_sandbox,
            max_memory_per_sandbox: org.max_memory_per_sandbox,
            max_disk_per_sandbox: org.max_disk_per_sandbox,
            max_image_size: org.max_image_size,
            image_quota: org.image_quota,
            bucket_quota: org.bucket_quota,
            suspended: org.suspended,
            suspended_at: org.suspended_at,
            suspension_reason: org.suspension_reason.clone(),
            suspended_until: org.suspended_until,
            created_at: org.created_at,
            updated_at: org.updated_at,
        }
    }
}
