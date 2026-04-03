// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::models::Registry;
use snapflow_models::RegistryType;

pub struct CreateRegistryParams<'a> {
    pub name: &'a str,
    pub url: &'a str,
    pub username: &'a str,
    pub password: &'a str,
    pub project: &'a str,
    pub registry_type: RegistryType,
    pub is_default: bool,
    pub organization_id: Option<Uuid>,
}

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    params: &CreateRegistryParams<'_>,
) -> sqlx::Result<Registry> {
    sqlx::query_as::<_, Registry>(
        "INSERT INTO registry (name, url, username, password, project, registry_type, is_default, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(params.name)
    .bind(params.url)
    .bind(params.username)
    .bind(params.password)
    .bind(params.project)
    .bind(params.registry_type)
    .bind(params.is_default)
    .bind(params.organization_id)
    .fetch_one(db)
    .await
}

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<Registry>> {
    sqlx::query_as::<_, Registry>("SELECT * FROM registry WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_all_by_org<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
) -> sqlx::Result<Vec<Registry>> {
    sqlx::query_as::<_, Registry>(
        "SELECT * FROM registry
         WHERE organization_id = $1
         ORDER BY created_at DESC",
    )
    .bind(org_id)
    .fetch_all(db)
    .await
}

pub async fn count_by_org<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM registry WHERE organization_id = $1")
        .bind(org_id)
        .fetch_one(db)
        .await
}

pub async fn update<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    name: &str,
    url: &str,
    username: &str,
    password: Option<&str>,
    project: Option<&str>,
) -> sqlx::Result<Registry> {
    sqlx::query_as::<_, Registry>(
        "UPDATE registry
         SET name = $1, url = $2, username = $3,
             password = COALESCE($4, password),
             project = COALESCE($5, project),
             updated_at = now()
         WHERE id = $6
         RETURNING *",
    )
    .bind(name)
    .bind(url)
    .bind(username)
    .bind(password)
    .bind(project)
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn delete<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM registry WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn unset_all_defaults<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE registry SET is_default = false WHERE is_default = true")
        .execute(db)
        .await?;
    Ok(())
}

pub async fn set_default<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Registry> {
    sqlx::query_as::<_, Registry>(
        "UPDATE registry SET is_default = true, updated_at = now() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn find_default_by_type<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    registry_type: RegistryType,
) -> sqlx::Result<Option<Registry>> {
    sqlx::query_as::<_, Registry>(
        "SELECT * FROM registry WHERE is_default = true AND registry_type = $1",
    )
    .bind(registry_type)
    .fetch_optional(db)
    .await
}

pub async fn find_candidates_for_image<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Option<Uuid>,
) -> sqlx::Result<Vec<Registry>> {
    let types = &[RegistryType::Internal, RegistryType::Organization];

    if let Some(org_id) = organization_id {
        sqlx::query_as::<_, Registry>(
            "SELECT * FROM registry
             WHERE registry_type = ANY($1)
             AND (organization_id = $2 OR organization_id IS NULL)",
        )
        .bind(types)
        .bind(org_id)
        .fetch_all(db)
        .await
    } else {
        sqlx::query_as::<_, Registry>(
            "SELECT * FROM registry
             WHERE registry_type = ANY($1)
             AND organization_id IS NULL",
        )
        .bind(types)
        .fetch_all(db)
        .await
    }
}
