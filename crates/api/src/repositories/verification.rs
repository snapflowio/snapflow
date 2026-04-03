// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::models::Verification;

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    identifier: &str,
    value: &str,
    expires_at: chrono::DateTime<chrono::Utc>,
) -> sqlx::Result<Verification> {
    sqlx::query_as::<_, Verification>(
        "INSERT INTO verification (identifier, value, expires_at)
         VALUES ($1, $2, $3)
         RETURNING *",
    )
    .bind(identifier)
    .bind(value)
    .bind(expires_at)
    .fetch_one(db)
    .await
}

pub async fn find_by_identifier_and_value<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    identifier: &str,
    value: &str,
) -> sqlx::Result<Option<Verification>> {
    sqlx::query_as::<_, Verification>(
        "SELECT * FROM verification
         WHERE identifier = $1 AND value = $2 AND expires_at > now()",
    )
    .bind(identifier)
    .bind(value)
    .fetch_optional(db)
    .await
}

pub async fn find_and_delete_by_identifier<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    identifier: &str,
) -> sqlx::Result<Option<Verification>> {
    sqlx::query_as::<_, Verification>(
        "DELETE FROM verification WHERE identifier = $1 AND expires_at > now() RETURNING *",
    )
    .bind(identifier)
    .fetch_optional(db)
    .await
}

pub async fn find_by_identifier<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    identifier: &str,
) -> sqlx::Result<Option<Verification>> {
    sqlx::query_as::<_, Verification>(
        "SELECT * FROM verification WHERE identifier = $1 AND expires_at > now()",
    )
    .bind(identifier)
    .fetch_optional(db)
    .await
}

pub async fn find_by_token<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    token: &str,
) -> sqlx::Result<Option<Verification>> {
    sqlx::query_as::<_, Verification>(
        "SELECT * FROM verification WHERE value = $1 AND expires_at > now()",
    )
    .bind(token)
    .fetch_optional(db)
    .await
}

pub async fn delete_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM verification WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn delete_expired<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<u64> {
    let result = sqlx::query("DELETE FROM verification WHERE expires_at <= now()")
        .execute(db)
        .await?;
    Ok(result.rows_affected())
}
