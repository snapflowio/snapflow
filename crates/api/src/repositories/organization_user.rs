// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::models::OrganizationRole;
use crate::models::OrganizationUser;
use snapflow_models::OrganizationMemberRole;

pub async fn find_all<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
) -> sqlx::Result<Vec<OrganizationUser>> {
    sqlx::query_as::<_, OrganizationUser>(
        "SELECT * FROM organization_user WHERE organization_id = $1 ORDER BY created_at ASC",
    )
    .bind(org_id)
    .fetch_all(db)
    .await
}

pub async fn find_one<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Option<OrganizationUser>> {
    sqlx::query_as::<_, OrganizationUser>(
        "SELECT * FROM organization_user WHERE organization_id = $1 AND user_id = $2",
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_optional(db)
    .await
}

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
    role: OrganizationMemberRole,
) -> sqlx::Result<OrganizationUser> {
    sqlx::query_as::<_, OrganizationUser>(
        "INSERT INTO organization_user (organization_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, user_id) DO NOTHING
         RETURNING *",
    )
    .bind(org_id)
    .bind(user_id)
    .bind(role)
    .fetch_one(db)
    .await
}

pub async fn update_role<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
    role: OrganizationMemberRole,
) -> sqlx::Result<OrganizationUser> {
    sqlx::query_as::<_, OrganizationUser>(
        "UPDATE organization_user SET role = $1, updated_at = now()
         WHERE organization_id = $2 AND user_id = $3
         RETURNING *",
    )
    .bind(role)
    .bind(org_id)
    .bind(user_id)
    .fetch_one(db)
    .await
}

pub async fn count_owners<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM organization_user WHERE organization_id = $1 AND role = $2",
    )
    .bind(org_id)
    .bind(OrganizationMemberRole::Owner)
    .fetch_one(db)
    .await
}

pub async fn delete<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM organization_user WHERE organization_id = $1 AND user_id = $2")
        .bind(org_id)
        .bind(user_id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn clear_assigned_roles<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query(
        "DELETE FROM organization_role_assignment
         WHERE organization_id = $1 AND user_id = $2",
    )
    .bind(org_id)
    .bind(user_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn assign_role<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
    role_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO organization_role_assignment (organization_id, user_id, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING",
    )
    .bind(org_id)
    .bind(user_id)
    .bind(role_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn find_assigned_roles<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Vec<OrganizationRole>> {
    sqlx::query_as::<_, OrganizationRole>(
        "SELECT r.* FROM organization_role r
         JOIN organization_role_assignment a ON a.role_id = r.id
         WHERE a.organization_id = $1 AND a.user_id = $2
         ORDER BY r.id ASC",
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_all(db)
    .await
}

pub async fn find_user_permissions<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Vec<String>> {
    sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT unnest(r.permissions)
         FROM organization_role_assignment a
         JOIN organization_role r ON r.id = a.role_id
         WHERE a.organization_id = $1 AND a.user_id = $2",
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_all(db)
    .await
}

pub async fn delete_all_for_user<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM organization_user WHERE user_id = $1")
        .bind(user_id)
        .execute(db)
        .await?;
    Ok(())
}
