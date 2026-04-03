// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::models::Bucket;
use snapflow_models::BucketState;

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<Bucket>> {
    sqlx::query_as::<_, Bucket>("SELECT * FROM bucket WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_by_organization<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    include_deleted: bool,
) -> sqlx::Result<Vec<Bucket>> {
    if include_deleted {
        sqlx::query_as::<_, Bucket>(
            "SELECT * FROM bucket
             WHERE organization_id = $1
             ORDER BY last_used_at DESC NULLS LAST, created_at DESC",
        )
        .bind(organization_id)
        .fetch_all(db)
        .await
    } else {
        sqlx::query_as::<_, Bucket>(
            "SELECT * FROM bucket
             WHERE organization_id = $1 AND state != $2
             ORDER BY last_used_at DESC NULLS LAST, created_at DESC",
        )
        .bind(organization_id)
        .bind(BucketState::Deleted)
        .fetch_all(db)
        .await
    }
}

pub async fn find_by_name<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    name: &str,
) -> sqlx::Result<Option<Bucket>> {
    sqlx::query_as::<_, Bucket>(
        "SELECT * FROM bucket
         WHERE organization_id = $1 AND name = $2 AND state != $3",
    )
    .bind(organization_id)
    .bind(name)
    .bind(BucketState::Deleted)
    .fetch_optional(db)
    .await
}

pub async fn count_active<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM bucket
         WHERE organization_id = $1
         AND state NOT IN ($2, $3)",
    )
    .bind(organization_id)
    .bind(BucketState::Deleted)
    .bind(BucketState::Error)
    .fetch_one(db)
    .await
}

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    created_by: Option<Uuid>,
    name: &str,
    size: i32,
) -> sqlx::Result<Bucket> {
    sqlx::query_as::<_, Bucket>(
        "INSERT INTO bucket (organization_id, created_by, name, size, state)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *",
    )
    .bind(organization_id)
    .bind(created_by)
    .bind(name)
    .bind(size)
    .bind(BucketState::PendingCreate)
    .fetch_one(db)
    .await
}

pub async fn update_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    new_state: BucketState,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE bucket SET state = $1, updated_at = now() WHERE id = $2")
        .bind(new_state)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_state_with_error<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    new_state: BucketState,
    error_reason: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE bucket SET state = $1, error_reason = $2, updated_at = now() WHERE id = $3",
    )
    .bind(new_state)
    .bind(error_reason)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn update_last_used<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE bucket SET last_used_at = now() WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn find_pending<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Bucket>> {
    sqlx::query_as::<_, Bucket>(
        "SELECT * FROM bucket
         WHERE state IN ($1, $2)
         ORDER BY created_at ASC",
    )
    .bind(BucketState::PendingCreate)
    .bind(BucketState::PendingDelete)
    .fetch_all(db)
    .await
}

pub async fn update_name<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    new_name: &str,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE bucket SET name = $1, updated_at = now() WHERE id = $2")
        .bind(new_name)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn delete_by_org_name_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    name: &str,
    state: BucketState,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM bucket WHERE organization_id = $1 AND name = $2 AND state = $3")
        .bind(organization_id)
        .bind(name)
        .bind(state)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn count_by_organization<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM bucket WHERE organization_id = $1")
        .bind(organization_id)
        .fetch_one(db)
        .await
}
