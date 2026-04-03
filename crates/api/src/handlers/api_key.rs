// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;

use crate::extractors::auth::SessionAuth;
use crate::extractors::organization::{OrgAccess, OrganizationContext};
use crate::extractors::validated_json::ValidatedJson;
use crate::schemas::api_key::{ApiKeyCreatedDto, ApiKeyDto, CreateApiKeyDto};
use crate::services;
use crate::state::AppState;
use snapflow_errors::{AppError, Result};

#[utoipa::path(
    post,
    path = "/api-keys",
    tag = "api-keys",
    operation_id = "createApiKey",
    summary = "Create API key",
    request_body = CreateApiKeyDto,
    responses(
        (status = 201, description = "API key created successfully.", body = ApiKeyCreatedDto),
    ),
    security(("bearer" = []))
)]
pub async fn create(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateApiKeyDto>,
) -> Result<(StatusCode, Json<ApiKeyCreatedDto>)> {
    let perm_strings: Vec<String> = body.permissions.iter().map(|p| p.to_string()).collect();

    services::api_key::validate_permissions(
        &state.infra.pool,
        org_ctx.organization.id,
        org_ctx.auth.user_id,
        &perm_strings,
        org_ctx.auth.role,
    )
    .await?;

    let response = services::api_key::create(
        &state.infra.pool,
        org_ctx.organization.id,
        org_ctx.auth.user_id,
        &body.name,
        &perm_strings,
        body.expires_at,
    )
    .await?;

    Ok((StatusCode::CREATED, Json(response)))
}

#[utoipa::path(
    get,
    path = "/api-keys",
    tag = "api-keys",
    operation_id = "listApiKeys",
    summary = "List API keys",
    responses(
        (status = 200, description = "API keys retrieved successfully.", body = Vec<ApiKeyDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<Json<Vec<ApiKeyDto>>> {
    let keys = services::api_key::find_all(
        &state.infra.pool,
        org_ctx.organization.id,
        org_ctx.auth.user_id,
    )
    .await?;

    Ok(Json(keys))
}

#[utoipa::path(
    get,
    path = "/api-keys/current",
    tag = "api-keys",
    operation_id = "getCurrentApiKey",
    summary = "Get current API key's details",
    responses(
        (status = 200, description = "API key retrieved successfully.", body = ApiKeyDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_current(
    ctx: SessionAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiKeyDto>> {
    let api_key = ctx.auth.api_key.as_ref().ok_or(AppError::BadRequest(
        "not authenticated with an API key".into(),
    ))?;
    let key = services::api_key::find_current(&state.infra.pool, api_key).await?;
    Ok(Json(key))
}

#[utoipa::path(
    get,
    path = "/api-keys/{name}",
    tag = "api-keys",
    operation_id = "getApiKey",
    summary = "Get API key by name",
    params(
        ("name" = String, Path, description = "Name of the API key"),
    ),
    responses(
        (status = 200, description = "API key retrieved successfully.", body = ApiKeyDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_by_name(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiKeyDto>> {
    let key = services::api_key::find_by_name(
        &state.infra.pool,
        org_ctx.organization.id,
        org_ctx.auth.user_id,
        &name,
    )
    .await?;

    Ok(Json(key))
}

#[utoipa::path(
    delete,
    path = "/api-keys/{name}",
    tag = "api-keys",
    operation_id = "deleteApiKey",
    summary = "Delete API key by name",
    params(
        ("name" = String, Path, description = "Name of the API key"),
    ),
    responses(
        (status = 204, description = "API key deleted successfully."),
    ),
    security(("bearer" = []))
)]
pub async fn delete(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<StatusCode> {
    services::api_key::delete(
        &state.infra,
        org_ctx.organization.id,
        org_ctx.auth.user_id,
        &name,
    )
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/api-keys/{user_id}/{name}",
    tag = "api-keys",
    operation_id = "deleteApiKeyForUser",
    summary = "Delete API key for a specific user",
    params(
        ("user_id" = Uuid, Path, description = "ID of the user"),
        ("name" = String, Path, description = "Name of the API key"),
    ),
    responses(
        (status = 204, description = "API key deleted successfully."),
    ),
    security(("bearer" = []))
)]
pub async fn delete_for_user(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path((user_id, name)): Path<(uuid::Uuid, String)>,
) -> Result<StatusCode> {
    org_ctx.require_owner()?;

    services::api_key::delete(&state.infra, org_ctx.organization.id, user_id, &name).await?;

    Ok(StatusCode::NO_CONTENT)
}
