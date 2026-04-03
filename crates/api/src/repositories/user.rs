// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::models::User;
use snapflow_models::SystemRole;

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(r#"SELECT * FROM "user" WHERE id = $1"#)
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_by_email<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    email: &str,
) -> sqlx::Result<Option<User>> {
    sqlx::query_as::<_, User>(r#"SELECT * FROM "user" WHERE email = $1"#)
        .bind(email)
        .fetch_optional(db)
        .await
}

pub async fn find_by_ids<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    ids: &[Uuid],
) -> sqlx::Result<Vec<User>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    sqlx::query_as::<_, User>(r#"SELECT * FROM "user" WHERE id = ANY($1)"#)
        .bind(ids)
        .fetch_all(db)
        .await
}

pub async fn find_all<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<User>> {
    sqlx::query_as::<_, User>(r#"SELECT * FROM "user" ORDER BY created_at DESC"#)
        .fetch_all(db)
        .await
}

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    name: &str,
    email: &str,
    role: SystemRole,
) -> sqlx::Result<User> {
    sqlx::query_as::<_, User>(
        r#"INSERT INTO "user" (name, email, role) VALUES ($1, $2, $3) RETURNING *"#,
    )
    .bind(name)
    .bind(email)
    .bind(role)
    .fetch_one(db)
    .await
}

pub async fn set_email_verified<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    verified: bool,
) -> sqlx::Result<User> {
    sqlx::query_as::<_, User>(
        r#"UPDATE "user" SET email_verified = $1, updated_at = now() WHERE id = $2 RETURNING *"#,
    )
    .bind(verified)
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn update_name<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    name: &str,
) -> sqlx::Result<User> {
    sqlx::query_as::<_, User>(
        r#"UPDATE "user" SET name = $1, updated_at = now() WHERE id = $2 RETURNING *"#,
    )
    .bind(name)
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn update_email<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    email: &str,
) -> sqlx::Result<User> {
    sqlx::query_as::<_, User>(
        r#"UPDATE "user" SET email = $1, updated_at = now() WHERE id = $2 RETURNING *"#,
    )
    .bind(email)
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn update_role<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    role: SystemRole,
) -> sqlx::Result<User> {
    sqlx::query_as::<_, User>(
        r#"UPDATE "user" SET role = $1, updated_at = now() WHERE id = $2 RETURNING *"#,
    )
    .bind(role)
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn delete<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query(r#"DELETE FROM "user" WHERE id = $1"#)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}
