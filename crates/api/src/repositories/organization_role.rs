// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::models::OrganizationRole;

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    name: &str,
    description: &str,
    permissions: &[String],
) -> sqlx::Result<OrganizationRole> {
    sqlx::query_as::<_, OrganizationRole>(
        "INSERT INTO organization_role (organization_id, name, description, permissions)
         VALUES ($1, $2, $3, $4)
         RETURNING *",
    )
    .bind(org_id)
    .bind(name)
    .bind(description)
    .bind(permissions)
    .fetch_one(db)
    .await
}

pub async fn find_all<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
) -> sqlx::Result<Vec<OrganizationRole>> {
    sqlx::query_as::<_, OrganizationRole>(
        "SELECT * FROM organization_role
         WHERE organization_id = $1 OR is_global = true
         ORDER BY id ASC",
    )
    .bind(org_id)
    .fetch_all(db)
    .await
}

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    role_id: Uuid,
) -> sqlx::Result<Option<OrganizationRole>> {
    sqlx::query_as::<_, OrganizationRole>("SELECT * FROM organization_role WHERE id = $1")
        .bind(role_id)
        .fetch_optional(db)
        .await
}

pub async fn find_by_ids<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    ids: &[Uuid],
) -> sqlx::Result<Vec<OrganizationRole>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    sqlx::query_as::<_, OrganizationRole>("SELECT * FROM organization_role WHERE id = ANY($1)")
        .bind(ids)
        .fetch_all(db)
        .await
}

pub async fn update<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    role_id: Uuid,
    name: &str,
    description: &str,
    permissions: &[String],
) -> sqlx::Result<OrganizationRole> {
    sqlx::query_as::<_, OrganizationRole>(
        "UPDATE organization_role
         SET name = $1, description = $2, permissions = $3, updated_at = now()
         WHERE id = $4
         RETURNING *",
    )
    .bind(name)
    .bind(description)
    .bind(permissions)
    .bind(role_id)
    .fetch_one(db)
    .await
}

pub async fn delete<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    role_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM organization_role WHERE id = $1")
        .bind(role_id)
        .execute(db)
        .await?;
    Ok(())
}
