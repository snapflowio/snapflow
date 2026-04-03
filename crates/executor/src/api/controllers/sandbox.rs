// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use prometheus::{CounterVec, HistogramVec};
use std::sync::Arc;
use std::time::Instant;

use validator::Validate;

use crate::api::dto::backup::CreateBackupDTO;
use crate::api::dto::sandbox::{
    CreateSandboxDTO, ResizeSandboxDTO, SandboxInfoResponse, UpdateNetworkSettingsDTO,
};
use crate::api::errors::{AppError, ErrorResponse, docker_error_to_app_error};
use crate::models::SandboxState;

use super::super::AppState;

#[utoipa::path(
    post,
    path = "/sandboxes",
    operation_id = "Create",
    tags = ["sandbox"],
    summary = "Create a sandbox",
    request_body = CreateSandboxDTO,
    responses(
        (status = 201, description = "Created", body = String),
        (status = 400, description = "Bad Request", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Not Found", body = ErrorResponse),
        (status = 409, description = "Conflict", body = ErrorResponse),
        (status = 500, description = "Internal Server Error", body = ErrorResponse),
    )
)]
pub async fn create(
    State(state): State<Arc<AppState>>,
    Json(dto): Json<CreateSandboxDTO>,
) -> Result<impl IntoResponse, AppError> {
    dto.validate()
        .map_err(|e| AppError::bad_request(format!("invalid request body: {}", e)))?;

    let start = Instant::now();

    let result = state.docker.create(&dto).await;

    let duration = start.elapsed().as_secs_f64();
    record_duration(&state.operation_duration, "create", duration);

    match result {
        Ok(container_id) => {
            record_count(&state.operation_count, "create", "success");
            Ok((StatusCode::CREATED, Json(container_id)))
        }
        Err(e) => {
            state
                .docker
                .cache
                .set_sandbox_state(&dto.id, SandboxState::Error)
                .await;
            record_count(&state.operation_count, "create", "failure");
            Err(docker_error_to_app_error(e))
        }
    }
}

#[utoipa::path(
    post,
    path = "/sandboxes/{sandboxId}/destroy",
    operation_id = "Destroy",
    tags = ["sandbox"],
    summary = "Destroy sandbox",
    params(("sandboxId" = String, Path, description = "Sandbox ID")),
    responses(
        (status = 200, description = "Sandbox destroyed", body = String),
        (status = 400, description = "Bad Request", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Not Found", body = ErrorResponse),
        (status = 409, description = "Conflict", body = ErrorResponse),
        (status = 500, description = "Internal Server Error", body = ErrorResponse),
    )
)]
pub async fn destroy(
    State(state): State<Arc<AppState>>,
    Path(sandbox_id): Path<String>,
) -> Result<Json<String>, AppError> {
    let start = Instant::now();

    let result = state.docker.destroy(&sandbox_id).await;

    let duration = start.elapsed().as_secs_f64();
    record_duration(&state.operation_duration, "destroy", duration);

    match result {
        Ok(_) => {
            record_count(&state.operation_count, "destroy", "success");
            Ok(Json("Sandbox destroyed".to_string()))
        }
        Err(e) => {
            state
                .docker
                .cache
                .set_sandbox_state(&sandbox_id, SandboxState::Error)
                .await;
            record_count(&state.operation_count, "destroy", "failure");
            Err(docker_error_to_app_error(e))
        }
    }
}

#[utoipa::path(
    post,
    path = "/sandboxes/{sandboxId}/start",
    operation_id = "Start",
    tags = ["sandbox"],
    summary = "Start sandbox",
    params(("sandboxId" = String, Path, description = "Sandbox ID")),
    responses(
        (status = 200, description = "Sandbox started", body = String),
        (status = 400, description = "Bad Request", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Not Found", body = ErrorResponse),
        (status = 409, description = "Conflict", body = ErrorResponse),
        (status = 500, description = "Internal Server Error", body = ErrorResponse),
    )
)]
pub async fn start(
    State(state): State<Arc<AppState>>,
    Path(sandbox_id): Path<String>,
) -> Result<Json<String>, AppError> {
    if let Err(e) = state.docker.start(&sandbox_id, None).await {
        state
            .docker
            .cache
            .set_sandbox_state(&sandbox_id, SandboxState::Error)
            .await;
        return Err(docker_error_to_app_error(e));
    }

    Ok(Json("Sandbox started".to_string()))
}

#[utoipa::path(
    post,
    path = "/sandboxes/{sandboxId}/stop",
    operation_id = "Stop",
    tags = ["sandbox"],
    summary = "Stop sandbox",
    params(("sandboxId" = String, Path, description = "Sandbox ID")),
    responses(
        (status = 200, description = "Sandbox stopped", body = String),
        (status = 400, description = "Bad Request", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Not Found", body = ErrorResponse),
        (status = 409, description = "Conflict", body = ErrorResponse),
        (status = 500, description = "Internal Server Error", body = ErrorResponse),
    )
)]
pub async fn stop(
    State(state): State<Arc<AppState>>,
    Path(sandbox_id): Path<String>,
) -> Result<Json<String>, AppError> {
    if let Err(e) = state.docker.stop(&sandbox_id).await {
        state
            .docker
            .cache
            .set_sandbox_state(&sandbox_id, SandboxState::Error)
            .await;
        return Err(docker_error_to_app_error(e));
    }

    Ok(Json("Sandbox stopped".to_string()))
}

#[utoipa::path(
    post,
    path = "/sandboxes/{sandboxId}/resize",
    operation_id = "Resize", 
    tags = ["sandbox"],
    summary = "Resize sandbox",
    params(("sandboxId" = String, Path, description = "Sandbox ID")),
    request_body = ResizeSandboxDTO,
    responses(
        (status = 200, description = "Sandbox resized", body = String),
        (status = 400, description = "Bad Request", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Not Found", body = ErrorResponse),
        (status = 409, description = "Conflict", body = ErrorResponse),
        (status = 500, description = "Internal Server Error", body = ErrorResponse),
    )
)]
pub async fn resize(
    State(state): State<Arc<AppState>>,
    Path(sandbox_id): Path<String>,
    Json(dto): Json<ResizeSandboxDTO>,
) -> Result<Json<String>, AppError> {
    dto.validate()
        .map_err(|e| AppError::bad_request(format!("invalid request body: {}", e)))?;

    if let Err(e) = state.docker.resize(&sandbox_id, &dto).await {
        state
            .docker
            .cache
            .set_sandbox_state(&sandbox_id, SandboxState::Error)
            .await;
        return Err(docker_error_to_app_error(e));
    }

    Ok(Json("Sandbox resized".to_string()))
}

#[utoipa::path(
    get,
    path = "/sandboxes/{sandboxId}",
    operation_id = "Info",
    tags = ["sandbox"],
    summary = "Get sandbox info",
    params(("sandboxId" = String, Path, description = "Sandbox ID")),
    responses(
        (status = 200, description = "Sandbox info", body = SandboxInfoResponse),
        (status = 400, description = "Bad Request", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Not Found", body = ErrorResponse),
        (status = 409, description = "Conflict", body = ErrorResponse),
        (status = 500, description = "Internal Server Error", body = ErrorResponse),
    )
)]
pub async fn info(
    State(state): State<Arc<AppState>>,
    Path(sandbox_id): Path<String>,
) -> Result<Json<SandboxInfoResponse>, AppError> {
    let data = state
        .sandbox_service
        .get_sandbox_states_info(&sandbox_id)
        .await;

    Ok(Json(SandboxInfoResponse {
        state: data.sandbox_state,
        backup_state: data.backup_state,
        backup_error: data.backup_error,
    }))
}

#[utoipa::path(
    delete,
    path = "/sandboxes/{sandboxId}",
    operation_id = "RemoveDestroyed",
    tags = ["sandbox"],
    summary = "Remove a destroyed sandbox",
    description = "Remove a sandbox that has been previously destroyed",
    params(("sandboxId" = String, Path, description = "Sandbox ID")),
    responses(
        (status = 200, description = "Sandbox removed", body = String),
        (status = 400, description = "Bad Request", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Not Found", body = ErrorResponse),
        (status = 409, description = "Conflict", body = ErrorResponse),
        (status = 500, description = "Internal Server Error", body = ErrorResponse),
    )
)]
pub async fn remove_destroyed(
    State(state): State<Arc<AppState>>,
    Path(sandbox_id): Path<String>,
) -> Result<Json<String>, AppError> {
    if let Err(e) = state
        .sandbox_service
        .remove_destroyed_sandbox(&sandbox_id)
        .await
    {
        let is_not_found = e
            .downcast_ref::<bollard::errors::Error>()
            .is_some_and(crate::docker::is_docker_not_found);
        let msg = e.to_string();
        let is_not_found_msg = msg.contains("404") || msg.contains("No such container");
        if !is_not_found && !is_not_found_msg {
            return Err(docker_error_to_app_error(e));
        }
    }

    Ok(Json("Sandbox removed".to_string()))
}

#[utoipa::path(
    post,
    path = "/sandboxes/{sandboxId}/backup",
    operation_id = "CreateBackup",
    tags = ["sandbox"],
    summary = "Create a backup of a sandbox",
    params(("sandboxId" = String, Path, description = "Sandbox ID")),
    request_body = CreateBackupDTO,
    responses(
        (status = 201, description = "Backup started", body = String),
        (status = 400, description = "Bad Request", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 500, description = "Internal Server Error", body = ErrorResponse),
    )
)]
pub async fn create_backup(
    State(state): State<Arc<AppState>>,
    Path(sandbox_id): Path<String>,
    Json(dto): Json<CreateBackupDTO>,
) -> Result<impl IntoResponse, AppError> {
    dto.validate()
        .map_err(|e| AppError::bad_request(format!("invalid request body: {}", e)))?;

    state
        .docker
        .cache
        .set_backup_state(&sandbox_id, crate::models::BackupState::Pending, None)
        .await;

    state.docker.start_backup(&sandbox_id, &dto);

    record_count(&state.operation_count, "backup", "started");
    Ok((StatusCode::CREATED, Json("Backup started".to_string())))
}

#[utoipa::path(
    post,
    path = "/sandboxes/{sandboxId}/network-settings",
    operation_id = "UpdateNetworkSettings",
    tags = ["sandbox"],
    summary = "Update sandbox network settings",
    description = "Update sandbox network settings including network blocking, allow lists, and egress limiting",
    params(
        ("sandboxId" = String, Path, description = "Sandbox ID")
    ),
    request_body = UpdateNetworkSettingsDTO,
    responses(
        (status = 200, description = "Network settings updated", body = String),
        (status = 400, body = ErrorResponse),
        (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse),
        (status = 409, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
pub async fn update_network_settings(
    State(state): State<Arc<AppState>>,
    Path(sandbox_id): Path<String>,
    Json(dto): Json<UpdateNetworkSettingsDTO>,
) -> Result<Json<String>, AppError> {
    // Inspect container to get IP and short ID
    let info = state
        .docker
        .container_inspect(&sandbox_id)
        .await
        .map_err(|e| AppError::bad_request(format!("failed to inspect container: {}", e)))?;

    let container_id = info
        .id
        .as_ref()
        .ok_or_else(|| AppError::bad_request("container has no ID"))?;
    let container_short_id = if container_id.len() >= 12 {
        &container_id[..12]
    } else {
        container_id.as_str()
    };
    let ip_address = state
        .docker
        .get_container_ip(&info)
        .ok_or_else(|| AppError::bad_request("sandbox does not have an IP address"))?;

    // Apply network rules
    if let Some(true) = dto.network_block_all {
        state
            .docker
            .set_network_rules(container_short_id, &ip_address, "")
            .await
            .map_err(|e| AppError::bad_request(format!("failed to set network rules: {}", e)))?;
    } else if let Some(allow_list) = dto.network_allow_list {
        state
            .docker
            .set_network_rules(container_short_id, &ip_address, &allow_list)
            .await
            .map_err(|e| AppError::bad_request(format!("failed to set network rules: {}", e)))?;
    }

    // Apply network limiter
    if let Some(true) = dto.network_limit_egress {
        state
            .docker
            .set_network_limiter(container_short_id, &ip_address)
            .await
            .map_err(|e| AppError::bad_request(format!("failed to set network limiter: {}", e)))?;
    }

    Ok(Json("Network settings updated".to_string()))
}

#[utoipa::path(
    get,
    path = "/sandboxes/{sandboxId}/network-settings",
    operation_id = "GetNetworkSettings",
    tags = ["sandbox"],
    summary = "Get sandbox network settings",
    description = "Get current network settings for a sandbox including blocking rules and limiters",
    params(
        ("sandboxId" = String, Path, description = "Sandbox ID")
    ),
    responses(
        (status = 200, description = "Network settings", body = UpdateNetworkSettingsDTO),
        (status = 400, body = ErrorResponse),
        (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse),
        (status = 409, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
pub async fn get_network_settings(
    State(state): State<Arc<AppState>>,
    Path(sandbox_id): Path<String>,
) -> Result<Json<UpdateNetworkSettingsDTO>, AppError> {
    // Get container short ID (first 12 chars)
    let container_short_id = if sandbox_id.len() >= 12 {
        &sandbox_id[..12]
    } else {
        &sandbox_id
    };

    // Get actual network settings from iptables
    let settings = state
        .docker
        .get_network_settings(container_short_id)
        .await
        .map_err(|e| AppError::internal(format!("failed to get network settings: {}", e)))?;

    Ok(Json(UpdateNetworkSettingsDTO {
        network_block_all: settings.network_block_all,
        network_allow_list: settings.network_allow_list,
        network_limit_egress: settings.network_limit_egress,
    }))
}

fn record_duration(histogram: &HistogramVec, operation: &str, duration: f64) {
    if let Ok(obs) = histogram.get_metric_with_label_values(&[operation]) {
        obs.observe(duration);
    }
}

fn record_count(counter: &CounterVec, operation: &str, status: &str) {
    if let Ok(c) = counter.get_metric_with_label_values(&[operation, status]) {
        c.inc();
    }
}
