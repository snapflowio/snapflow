// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use serde::Deserialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::extractors::auth::AdminOrProxyAuth;
use crate::extractors::validated_json::ValidatedJson;
use crate::schemas::sandbox::{CreateExecutorDto, ExecutorDto, ExecutorImageDto};
use crate::services;
use crate::state::AppState;
use snapflow_errors::Result;

#[derive(Deserialize, ToSchema)]
pub struct UpdateSchedulingBody {
    pub unschedulable: bool,
}

#[derive(Deserialize)]
pub struct ImageRefQuery {
    #[serde(rename = "ref")]
    pub image_ref: String,
}

#[utoipa::path(
    post,
    path = "/executors",
    tag = "executors",
    operation_id = "createExecutor",
    summary = "Create executor",
    request_body = CreateExecutorDto,
    responses(
        (status = 201, description = "Executor created successfully.", body = ExecutorDto),
    ),
    security(("bearer" = []))
)]
pub async fn create(
    _ctx: AdminOrProxyAuth,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateExecutorDto>,
) -> Result<(StatusCode, Json<ExecutorDto>)> {
    let executor = services::executor::create(&state.infra.pool, &body).await?;

    Ok((StatusCode::CREATED, Json(ExecutorDto::from(&executor))))
}

#[utoipa::path(
    get,
    path = "/executors",
    tag = "executors",
    operation_id = "listExecutors",
    summary = "List all executors",
    responses(
        (status = 200, description = "List of all executors.", body = Vec<ExecutorDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list(
    _ctx: AdminOrProxyAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<ExecutorDto>>> {
    let executors = services::executor::find_all(&state.infra.pool).await?;

    Ok(Json(executors.iter().map(ExecutorDto::from).collect()))
}

#[utoipa::path(
    patch,
    path = "/executors/{id}/scheduling",
    tag = "executors",
    operation_id = "updateExecutorScheduling",
    summary = "Update executor scheduling status",
    params(
        ("id" = Uuid, Path, description = "ID of the executor"),
    ),
    responses(
        (status = 200, description = "Executor scheduling status updated.", body = ExecutorDto),
    ),
    security(("bearer" = []))
)]
pub async fn update_scheduling(
    _ctx: AdminOrProxyAuth,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSchedulingBody>,
) -> Result<Json<ExecutorDto>> {
    let executor =
        services::executor::update_scheduling_status(&state.infra.pool, id, body.unschedulable)
            .await?;

    Ok(Json(ExecutorDto::from(&executor)))
}

#[utoipa::path(
    get,
    path = "/executors/by-sandbox/{sandboxId}",
    tag = "executors",
    operation_id = "getExecutorBySandboxId",
    summary = "Get executor by sandbox ID",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "Executor found.", body = ExecutorDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_by_sandbox_id(
    _ctx: AdminOrProxyAuth,
    State(state): State<AppState>,
    Path(sandbox_id): Path<Uuid>,
) -> Result<Json<ExecutorDto>> {
    let executor = services::executor::find_by_sandbox_id(&state.infra.pool, sandbox_id).await?;

    Ok(Json(ExecutorDto::from(&executor)))
}

#[utoipa::path(
    get,
    path = "/executors/by-image-ref",
    tag = "executors",
    operation_id = "getExecutorsByImageRef",
    summary = "Get executors by image ref",
    params(
        ("ref" = String, Query, description = "Image ref"),
    ),
    responses(
        (status = 200, description = "Executors found for the image.", body = Vec<ExecutorImageDto>),
    ),
    security(("bearer" = []))
)]
pub async fn get_by_image_ref(
    _ctx: AdminOrProxyAuth,
    State(state): State<AppState>,
    Query(query): Query<ImageRefQuery>,
) -> Result<Json<Vec<ExecutorImageDto>>> {
    let executors =
        services::executor::get_executors_by_image_ref(&state.infra.pool, &query.image_ref).await?;

    Ok(Json(executors))
}
