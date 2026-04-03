// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories;
use snapflow_errors::{AppError, Result};

pub async fn has_sandbox_access(
    pool: &PgPool,
    sandbox_id: Uuid,
    user_id: Uuid,
    api_key_org_id: Option<Uuid>,
) -> Result<bool> {
    let sandbox = repositories::sandbox::find_by_id(pool, sandbox_id)
        .await?
        .ok_or(AppError::NotFound("sandbox not found".into()))?;

    if let Some(org_id) = api_key_org_id {
        return Ok(org_id == sandbox.organization_id);
    }

    let is_member =
        repositories::organization_user::find_one(pool, sandbox.organization_id, user_id)
            .await?
            .is_some();

    Ok(is_member)
}

pub async fn is_valid_auth_token(
    pool: &PgPool,
    sandbox_id: Uuid,
    auth_token: &str,
) -> Result<bool> {
    let sandbox = repositories::sandbox::find_by_id(pool, sandbox_id)
        .await?
        .ok_or(AppError::NotFound("sandbox not found".into()))?;

    Ok(sandbox.auth_token == auth_token)
}

pub async fn is_sandbox_public(pool: &PgPool, sandbox_id: Uuid) -> Result<bool> {
    let sandbox = repositories::sandbox::find_by_id(pool, sandbox_id)
        .await?
        .ok_or(AppError::NotFound("sandbox not found".into()))?;

    Ok(sandbox.public)
}
