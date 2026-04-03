// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;

use crate::constants::permissions;
use crate::extractors::organization::{OrgAccess, OrgResourceAccess, OrganizationResourceContext};
use crate::extractors::registry::RegistryAccess;
use crate::extractors::validated_json::ValidatedJson;
use crate::schemas::registry::{
    CreateRegistryDto, RegistryDto, RegistryPushAccessDto, UpdateRegistryDto,
};
use crate::services;
use crate::state::AppState;
use snapflow_errors::Result;

#[utoipa::path(
    post,
    path = "/registry",
    tag = "registry",
    operation_id = "createRegistry",
    summary = "Create registry",
    request_body = CreateRegistryDto,
    responses(
        (status = 201, description = "The registry has been successfully created.", body = RegistryDto),
    ),
    security(("bearer" = []))
)]
pub async fn create(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateRegistryDto>,
) -> Result<(StatusCode, Json<RegistryDto>)> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_REGISTRIES])
        .await?;

    let registry = services::registry::create(
        &state.infra.pool,
        &body,
        org_ctx.organization.id,
        org_ctx.auth.role,
    )
    .await?;

    Ok((StatusCode::CREATED, Json(RegistryDto::from(&registry))))
}

#[utoipa::path(
    get,
    path = "/registry",
    tag = "registry",
    operation_id = "listRegistries",
    summary = "List registries",
    responses(
        (status = 200, description = "List of all container registries.", body = Vec<RegistryDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
) -> Result<Json<Vec<RegistryDto>>> {
    let registries =
        services::registry::find_all(&state.infra.pool, org_ctx.organization.id).await?;
    Ok(Json(registries))
}

#[utoipa::path(
    get,
    path = "/registry/registry-push-access",
    tag = "registry",
    operation_id = "getTransientPushAccess",
    summary = "Get temporary registry access for pushing images",
    responses(
        (status = 200, description = "Temporary registry access has been generated.", body = RegistryPushAccessDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_push_access(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
) -> Result<Json<RegistryPushAccessDto>> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_REGISTRIES])
        .await?;

    let response = services::registry::get_push_access(
        &state.infra.pool,
        org_ctx.organization.id,
        org_ctx.auth.user_id,
    )
    .await?;

    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/registry/{id}",
    tag = "registry",
    operation_id = "getRegistry",
    summary = "Get registry",
    params(
        ("id" = Uuid, Path, description = "ID of the registry"),
    ),
    responses(
        (status = 200, description = "The container registry.", body = RegistryDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_by_id(access: RegistryAccess) -> Result<Json<RegistryDto>> {
    Ok(Json(RegistryDto::from(&access.registry)))
}

#[utoipa::path(
    patch,
    path = "/registry/{id}",
    tag = "registry",
    operation_id = "updateRegistry",
    summary = "Update registry",
    params(
        ("id" = Uuid, Path, description = "ID of the registry"),
    ),
    request_body = UpdateRegistryDto,
    responses(
        (status = 200, description = "The container registry has been successfully updated.", body = RegistryDto),
    ),
    security(("bearer" = []))
)]
pub async fn update(
    access: RegistryAccess,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<UpdateRegistryDto>,
) -> Result<Json<RegistryDto>> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_REGISTRIES])
        .await?;

    let registry = services::registry::update(&state.infra.pool, access.registry.id, &body).await?;
    Ok(Json(RegistryDto::from(&registry)))
}

#[utoipa::path(
    delete,
    path = "/registry/{id}",
    tag = "registry",
    operation_id = "deleteRegistry",
    summary = "Delete registry",
    params(
        ("id" = Uuid, Path, description = "ID of the container registry"),
    ),
    responses(
        (status = 204, description = "The container registry has been successfully deleted."),
    ),
    security(("bearer" = []))
)]
pub async fn delete(access: RegistryAccess, State(state): State<AppState>) -> Result<StatusCode> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::DELETE_REGISTRIES])
        .await?;

    services::registry::delete(&state.infra.pool, access.registry.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/registry/{id}/set-default",
    tag = "registry",
    operation_id = "setDefaultRegistry",
    summary = "Set default registry",
    params(
        ("id" = Uuid, Path, description = "ID of the container registry"),
    ),
    responses(
        (status = 200, description = "The container registry has been set as default.", body = RegistryDto),
    ),
    security(("bearer" = []))
)]
pub async fn set_default(
    access: RegistryAccess,
    State(state): State<AppState>,
) -> Result<Json<RegistryDto>> {
    access.org_ctx.require_admin()?;

    let registry = services::registry::set_default(&state.infra.pool, access.registry.id).await?;
    Ok(Json(RegistryDto::from(&registry)))
}
