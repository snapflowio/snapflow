// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use axum::Json;
use axum::extract::State;

use crate::api::dto::info::{ExecutorInfoResponseDTO, ExecutorMetrics};
use crate::api::errors::AppError;

use super::super::AppState;

#[utoipa::path(
    get,
    path = "/info",
    operation_id = "ExecutorInfo",
    summary = "Executor info",
    description = "Executor info with system metrics",
    responses(
        (status = 200, description = "OK", body = ExecutorInfoResponseDTO),
    )
)]
pub async fn executor_info(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ExecutorInfoResponseDTO>, AppError> {
    let m = state.metrics_service.get_cached_system_metrics().await;

    Ok(Json(ExecutorInfoResponseDTO {
        metrics: Some(ExecutorMetrics {
            current_cpu_usage_percentage: m.cpu_usage,
            current_memory_usage_percentage: m.ram_usage,
            current_disk_usage_percentage: m.disk_usage,
            current_allocated_cpu: m.allocated_cpu,
            current_allocated_memory_gi_b: m.allocated_memory,
            current_allocated_disk_gi_b: m.allocated_disk,
            current_image_count: m.image_count,
        }),
    }))
}
