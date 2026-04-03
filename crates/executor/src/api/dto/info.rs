// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorMetrics {
    pub current_cpu_usage_percentage: f64,
    pub current_memory_usage_percentage: f64,
    pub current_disk_usage_percentage: f64,
    pub current_allocated_cpu: i32,
    pub current_allocated_memory_gi_b: i32,
    pub current_allocated_disk_gi_b: i32,
    pub current_image_count: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorInfoResponseDTO {
    pub metrics: Option<ExecutorMetrics>,
}
