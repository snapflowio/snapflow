// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::OrganizationUser;
use crate::repositories;
use crate::schemas::organization::{OrganizationRoleDto, OrganizationUserDto, parse_permissions};
use snapflow_errors::{AppError, Result};
use snapflow_models::OrganizationMemberRole;

pub async fn find_all(pool: &PgPool, org_id: Uuid) -> Result<Vec<OrganizationUserDto>> {
    let org_users = repositories::organization_user::find_all(pool, org_id).await?;

    let user_ids: Vec<Uuid> = org_users.iter().map(|ou| ou.user_id).collect();
    let users = repositories::user::find_by_ids(pool, &user_ids).await?;

    let mut responses = Vec::default();
    for ou in &org_users {
        let Some(user) = users.iter().find(|u| u.id == ou.user_id) else {
            continue;
        };

        let assigned = load_assigned_roles(pool, org_id, ou.user_id).await?;

        responses.push(OrganizationUserDto {
            user_id: ou.user_id,
            organization_id: ou.organization_id,
            name: user.name.clone(),
            email: user.email.clone(),
            role: ou.role,
            assigned_roles: assigned,
            created_at: ou.created_at,
            updated_at: ou.updated_at,
        });
    }

    Ok(responses)
}

pub async fn find_one(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
) -> Result<Option<OrganizationUser>> {
    Ok(repositories::organization_user::find_one(pool, org_id, user_id).await?)
}

pub async fn update_role(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    role: OrganizationMemberRole,
) -> Result<OrganizationUser> {
    if role != OrganizationMemberRole::Owner {
        let owner_count = repositories::organization_user::count_owners(pool, org_id).await?;
        let current = repositories::organization_user::find_one(pool, org_id, user_id)
            .await?
            .ok_or(AppError::NotFound("organization member not found".into()))?;

        if current.role == OrganizationMemberRole::Owner && owner_count <= 1 {
            return Err(AppError::BadRequest(
                "cannot remove the last owner from the organization".into(),
            ));
        }
    }

    Ok(repositories::organization_user::update_role(pool, org_id, user_id, role).await?)
}

pub async fn update_assigned_roles(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    role_ids: &[Uuid],
) -> Result<()> {
    let found = repositories::organization_role::find_by_ids(pool, role_ids).await?;
    if found.len() != role_ids.len() {
        return Err(AppError::BadRequest(
            "one or more role IDs are invalid".into(),
        ));
    }

    repositories::organization_user::clear_assigned_roles(pool, org_id, user_id).await?;

    for role_id in role_ids {
        repositories::organization_user::assign_role(pool, org_id, user_id, *role_id).await?;
    }

    Ok(())
}

pub async fn delete(pool: &PgPool, org_id: Uuid, user_id: Uuid) -> Result<()> {
    repositories::organization_user::delete(pool, org_id, user_id).await?;
    Ok(())
}

pub async fn load_assigned_roles(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<OrganizationRoleDto>> {
    let roles = repositories::organization_user::find_assigned_roles(pool, org_id, user_id).await?;

    Ok(roles
        .iter()
        .map(|r| OrganizationRoleDto {
            id: r.id,
            name: r.name.clone(),
            description: r.description.clone(),
            permissions: parse_permissions(&r.permissions),
            is_global: r.is_global,
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
        .collect())
}
