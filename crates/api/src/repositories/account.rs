// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::constants::providers;
use crate::models::Account;

pub async fn find_by_user_id_and_provider<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
    provider_id: &str,
) -> sqlx::Result<Option<Account>> {
    sqlx::query_as::<_, Account>("SELECT * FROM account WHERE user_id = $1 AND provider_id = $2")
        .bind(user_id)
        .bind(provider_id)
        .fetch_optional(db)
        .await
}

pub async fn create_email_account<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
    password_hash: &str,
) -> sqlx::Result<Account> {
    sqlx::query_as::<_, Account>(
        "INSERT INTO account (user_id, account_id, provider_id, password)
         VALUES ($1, $2, $3, $4)
         RETURNING *",
    )
    .bind(user_id)
    .bind(user_id.to_string())
    .bind(providers::EMAIL)
    .bind(password_hash)
    .fetch_one(db)
    .await
}

pub async fn update_password<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
    password_hash: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE account SET password = $1, updated_at = now()
         WHERE user_id = $2 AND provider_id = $3",
    )
    .bind(password_hash)
    .bind(user_id)
    .bind(providers::EMAIL)
    .execute(db)
    .await?;
    Ok(())
}
