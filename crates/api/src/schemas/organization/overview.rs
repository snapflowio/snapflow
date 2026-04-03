// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
#[schema(as = UsageOverview)]
#[serde(rename_all = "camelCase")]
pub struct UsageOverviewDto {
    pub total_cpu_quota: i32,
    pub total_gpu_quota: i32,
    pub total_memory_quota: i32,
    pub total_disk_quota: i32,
    pub current_cpu_usage: i64,
    pub current_gpu_usage: i64,
    pub current_memory_usage: i64,
    pub current_disk_usage: i64,
    pub total_image_quota: i32,
    pub current_image_usage: i64,
    pub total_bucket_quota: i32,
    pub current_bucket_usage: i64,
}
