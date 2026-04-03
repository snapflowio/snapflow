// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use sqlx::Postgres;
use uuid::Uuid;

use crate::models::RefreshToken;

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
    token_hash: &str,
    jti: &str,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
    expires_at: DateTime<Utc>,
) -> sqlx::Result<RefreshToken> {
    sqlx::query_as::<_, RefreshToken>(
        "INSERT INTO refresh_token (user_id, token_hash, jti, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
    )
    .bind(user_id)
    .bind(token_hash)
    .bind(jti)
    .bind(ip_address)
    .bind(user_agent)
    .bind(expires_at)
    .fetch_one(db)
    .await
}

pub async fn find_by_token_hash<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    token_hash: &str,
) -> sqlx::Result<Option<RefreshToken>> {
    sqlx::query_as::<_, RefreshToken>(
        "SELECT * FROM refresh_token
         WHERE token_hash = $1 AND expires_at > now() AND revoked = false",
    )
    .bind(token_hash)
    .fetch_optional(db)
    .await
}

pub async fn find_by_jti<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    jti: &str,
) -> sqlx::Result<Option<RefreshToken>> {
    sqlx::query_as::<_, RefreshToken>(
        "SELECT * FROM refresh_token
         WHERE jti = $1 AND expires_at > now() AND revoked = false",
    )
    .bind(jti)
    .fetch_optional(db)
    .await
}

pub async fn revoke_by_token_hash<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    token_hash: &str,
) -> sqlx::Result<bool> {
    let result = sqlx::query(
        "UPDATE refresh_token
         SET revoked = true, revoked_at = now(), updated_at = now()
         WHERE token_hash = $1 AND revoked = false",
    )
    .bind(token_hash)
    .execute(db)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn revoke_all_for_user<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "UPDATE refresh_token
         SET revoked = true, revoked_at = now(), updated_at = now()
         WHERE user_id = $1 AND revoked = false",
    )
    .bind(user_id)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}

pub async fn delete_expired<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<u64> {
    let result = sqlx::query("DELETE FROM refresh_token WHERE expires_at <= now()")
        .execute(db)
        .await?;
    Ok(result.rows_affected())
}

pub async fn delete_revoked_older_than<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    days: i64,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "DELETE FROM refresh_token
         WHERE revoked = true AND revoked_at < now() - interval '1 day' * $1",
    )
    .bind(days)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}
