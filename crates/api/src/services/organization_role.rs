// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::OrganizationRole;
use crate::repositories;
use snapflow_errors::{AppError, Result};

pub async fn create(
    pool: &PgPool,
    org_id: Uuid,
    name: &str,
    description: &str,
    permissions: &[String],
) -> Result<OrganizationRole> {
    Ok(
        repositories::organization_role::create(pool, org_id, name, description, permissions)
            .await?,
    )
}

pub async fn find_all(pool: &PgPool, org_id: Uuid) -> Result<Vec<OrganizationRole>> {
    Ok(repositories::organization_role::find_all(pool, org_id).await?)
}

pub async fn update(
    pool: &PgPool,
    role_id: Uuid,
    name: &str,
    description: &str,
    permissions: &[String],
) -> Result<OrganizationRole> {
    let role = repositories::organization_role::find_by_id(pool, role_id)
        .await?
        .ok_or(AppError::NotFound("role not found".into()))?;

    if role.is_global {
        return Err(AppError::Forbidden("cannot modify global roles".into()));
    }

    Ok(
        repositories::organization_role::update(pool, role_id, name, description, permissions)
            .await?,
    )
}

pub async fn delete(pool: &PgPool, role_id: Uuid) -> Result<()> {
    let role = repositories::organization_role::find_by_id(pool, role_id)
        .await?
        .ok_or(AppError::NotFound("role not found".into()))?;

    if role.is_global {
        return Err(AppError::Forbidden("cannot delete global roles".into()));
    }

    repositories::organization_role::delete(pool, role_id).await?;
    Ok(())
}
