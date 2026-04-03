// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use sqlx::Postgres;
use uuid::Uuid;

use crate::models::ApiKey;

pub struct CreateApiKeyParams<'a> {
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub name: &'a str,
    pub key_hash: &'a str,
    pub key_prefix: &'a str,
    pub key_suffix: &'a str,
    pub permissions: &'a [String],
    pub expires_at: Option<DateTime<Utc>>,
}

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    params: &CreateApiKeyParams<'_>,
) -> sqlx::Result<ApiKey> {
    sqlx::query_as::<_, ApiKey>(
        "INSERT INTO api_key (organization_id, user_id, name, key_hash, key_prefix, key_suffix, permissions, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(params.org_id)
    .bind(params.user_id)
    .bind(params.name)
    .bind(params.key_hash)
    .bind(params.key_prefix)
    .bind(params.key_suffix)
    .bind(params.permissions)
    .bind(params.expires_at)
    .fetch_one(db)
    .await
}

pub async fn find_by_key_hash<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    key_hash: &str,
) -> sqlx::Result<Option<ApiKey>> {
    sqlx::query_as::<_, ApiKey>("SELECT * FROM api_key WHERE key_hash = $1")
        .bind(key_hash)
        .fetch_optional(db)
        .await
}

pub async fn find_by_org_and_user<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Vec<ApiKey>> {
    sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_key
         WHERE organization_id = $1 AND user_id = $2
         ORDER BY last_used_at DESC NULLS LAST, created_at DESC",
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_all(db)
    .await
}

pub async fn find_by_name<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
    name: &str,
) -> sqlx::Result<Option<ApiKey>> {
    sqlx::query_as::<_, ApiKey>(
        "SELECT * FROM api_key WHERE organization_id = $1 AND user_id = $2 AND name = $3",
    )
    .bind(org_id)
    .bind(user_id)
    .bind(name)
    .fetch_optional(db)
    .await
}

pub async fn delete<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
    name: &str,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM api_key WHERE organization_id = $1 AND user_id = $2 AND name = $3")
        .bind(org_id)
        .bind(user_id)
        .bind(name)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_last_used<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    org_id: Uuid,
    user_id: Uuid,
    name: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE api_key SET last_used_at = now()
         WHERE organization_id = $1 AND user_id = $2 AND name = $3",
    )
    .bind(org_id)
    .bind(user_id)
    .bind(name)
    .execute(db)
    .await?;
    Ok(())
}
