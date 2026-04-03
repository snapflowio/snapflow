// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Deserialize;
use utoipa::ToSchema;
use validator::Validate;

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = UpdateQuota)]
#[serde(rename_all = "camelCase")]
pub struct UpdateQuotaDto {
    pub total_cpu_quota: Option<i32>,
    pub total_memory_quota: Option<i32>,
    pub total_disk_quota: Option<i32>,
    pub max_cpu_per_sandbox: Option<i32>,
    pub max_memory_per_sandbox: Option<i32>,
    pub max_disk_per_sandbox: Option<i32>,
    pub max_image_size: Option<i32>,
    pub image_quota: Option<i32>,
    pub bucket_quota: Option<i32>,
}
