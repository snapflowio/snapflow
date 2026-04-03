// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;

use crate::extractors::auth::AuthContext;
use crate::services;
use crate::state::AppState;
use snapflow_errors::{AppError, Result};

#[utoipa::path(
    get,
    path = "/preview/{sandboxId}/access",
    tag = "preview",
    operation_id = "hasSandboxAccess",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "User has access to this sandbox"),
        (status = 404, description = "Sandbox not found or no access"),
    ),
    security(("bearer" = []))
)]
pub async fn has_sandbox_access(
    auth: AuthContext,
    State(state): State<AppState>,
    Path(sandbox_id): Path<Uuid>,
) -> Result<StatusCode> {
    let api_key_org_id = auth.api_key.as_ref().map(|k| k.organization_id);

    let has_access = services::preview::has_sandbox_access(
        &state.infra.pool,
        sandbox_id,
        auth.user_id,
        api_key_org_id,
    )
    .await?;

    if !has_access {
        return Err(AppError::NotFound("sandbox not found".into()));
    }

    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/preview/{sandboxId}/validate/{authToken}",
    tag = "preview",
    operation_id = "isValidAuthToken",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
        ("authToken" = String, Path, description = "Auth token to validate"),
    ),
    responses(
        (status = 200, description = "Token validity", body = bool),
    )
)]
pub async fn is_valid_auth_token(
    State(state): State<AppState>,
    Path((sandbox_id, auth_token)): Path<(Uuid, String)>,
) -> Result<Json<bool>> {
    let valid =
        services::preview::is_valid_auth_token(&state.infra.pool, sandbox_id, &auth_token).await?;
    Ok(Json(valid))
}

#[utoipa::path(
    get,
    path = "/preview/{sandboxId}/public",
    tag = "preview",
    operation_id = "isSandboxPublic",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "Public status", body = bool),
    )
)]
pub async fn is_sandbox_public(
    State(state): State<AppState>,
    Path(sandbox_id): Path<Uuid>,
) -> Result<Json<bool>> {
    let is_public = services::preview::is_sandbox_public(&state.infra.pool, sandbox_id).await?;
    Ok(Json(is_public))
}
