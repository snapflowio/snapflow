// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use sqlx::Postgres;
use uuid::Uuid;

use crate::models::Image;
use snapflow_models::{ImageExecutorState, ImageState};

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<Image>> {
    sqlx::query_as::<_, Image>("SELECT * FROM image WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_by_name<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    name: &str,
    organization_id: Uuid,
) -> sqlx::Result<Option<Image>> {
    sqlx::query_as::<_, Image>("SELECT * FROM image WHERE name = $1 AND organization_id = $2")
        .bind(name)
        .bind(organization_id)
        .fetch_optional(db)
        .await
}

pub async fn find_general_by_name<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    name: &str,
) -> sqlx::Result<Option<Image>> {
    sqlx::query_as::<_, Image>("SELECT * FROM image WHERE name = $1 AND general = true")
        .bind(name)
        .fetch_optional(db)
        .await
}

pub async fn find_by_organization_paginated<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    limit: i64,
    offset: i64,
) -> sqlx::Result<Vec<Image>> {
    sqlx::query_as::<_, Image>(
        "SELECT * FROM image
         WHERE (organization_id = $1)
            OR (general = true AND hide_from_users = false)
         ORDER BY general ASC, last_used_at DESC NULLS LAST, created_at DESC
         LIMIT $2 OFFSET $3",
    )
    .bind(organization_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(db)
    .await
}

pub async fn count_by_organization<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM image
         WHERE (organization_id = $1)
            OR (general = true AND hide_from_users = false)",
    )
    .bind(organization_id)
    .fetch_one(db)
    .await
}

pub struct CreateImageParams<'a> {
    pub organization_id: Option<Uuid>,
    pub name: &'a str,
    pub image_name: &'a str,
    pub general: bool,
    pub state: ImageState,
    pub cpu: i32,
    pub gpu: i32,
    pub mem: i32,
    pub disk: i32,
    pub entrypoint: Option<&'a [String]>,
    pub cmd: Option<&'a [String]>,
    pub build_info_image_ref: Option<&'a str>,
}

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    params: &CreateImageParams<'_>,
) -> sqlx::Result<Image> {
    sqlx::query_as::<_, Image>(
        "INSERT INTO image (
            organization_id, name, image_name, general, state,
            cpu, gpu, mem, disk, entrypoint, cmd, build_info_image_ref
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *",
    )
    .bind(params.organization_id)
    .bind(params.name)
    .bind(params.image_name)
    .bind(params.general)
    .bind(params.state)
    .bind(params.cpu)
    .bind(params.gpu)
    .bind(params.mem)
    .bind(params.disk)
    .bind(params.entrypoint)
    .bind(params.cmd)
    .bind(params.build_info_image_ref)
    .fetch_one(db)
    .await
}

pub async fn update_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    new_state: ImageState,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE image SET state = $1, updated_at = now() WHERE id = $2")
        .bind(new_state)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_state_with_error<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    new_state: ImageState,
    error_reason: &str,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE image SET state = $1, error_reason = $2, updated_at = now() WHERE id = $3")
        .bind(new_state)
        .bind(error_reason)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_general<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    general: bool,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE image SET general = $1, updated_at = now() WHERE id = $2")
        .bind(general)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn activate<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    state: ImageState,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE image SET state = $1, last_used_at = now(), updated_at = now() WHERE id = $2",
    )
    .bind(state)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn update_last_used<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE image SET last_used_at = now() WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn find_by_internal_name_active<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    internal_name: &str,
) -> sqlx::Result<Option<Image>> {
    sqlx::query_as::<_, Image>(
        "SELECT * FROM image
         WHERE internal_name = $1
         AND state NOT IN ($2, $3)",
    )
    .bind(internal_name)
    .bind(ImageState::Error)
    .bind(ImageState::BuildFailed)
    .fetch_optional(db)
    .await
}

pub async fn find_active_by_name<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    name: &str,
    organization_id: Option<Uuid>,
) -> sqlx::Result<Option<Image>> {
    match organization_id {
        Some(org_id) => {
            sqlx::query_as::<_, Image>(
                "SELECT * FROM image
                 WHERE (name = $1 OR id::text = $1)
                 AND state = $2
                 AND (organization_id = $3 OR general = true)",
            )
            .bind(name)
            .bind(ImageState::Active)
            .bind(org_id)
            .fetch_optional(db)
            .await
        }
        None => {
            sqlx::query_as::<_, Image>(
                "SELECT * FROM image
                 WHERE (name = $1 OR id::text = $1)
                 AND state = $2
                 AND general = true",
            )
            .bind(name)
            .bind(ImageState::Active)
            .fetch_optional(db)
            .await
        }
    }
}

pub async fn find_by_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    state: ImageState,
) -> sqlx::Result<Vec<Image>> {
    sqlx::query_as::<_, Image>("SELECT * FROM image WHERE state = $1")
        .bind(state)
        .fetch_all(db)
        .await
}

pub async fn find_old_inactive<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    before: DateTime<Utc>,
    limit: i64,
) -> sqlx::Result<Vec<Image>> {
    sqlx::query_as::<_, Image>(
        "SELECT * FROM image
         WHERE general = false
         AND state = $1
         AND (last_used_at IS NULL OR last_used_at < $2)
         AND created_at < $2
         LIMIT $3",
    )
    .bind(ImageState::Active)
    .bind(before)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn bulk_update_state_by_ids<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    ids: &[Uuid],
    new_state: ImageState,
) -> sqlx::Result<u64> {
    if ids.is_empty() {
        return Ok(0);
    }
    let result = sqlx::query("UPDATE image SET state = $1, updated_at = now() WHERE id = ANY($2)")
        .bind(new_state)
        .bind(ids)
        .execute(db)
        .await?;
    Ok(result.rows_affected())
}

pub async fn find_inactive_with_active_executors<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    limit: i64,
) -> sqlx::Result<Vec<Image>> {
    sqlx::query_as::<_, Image>(
        "SELECT i.* FROM image i
         WHERE i.state = $1
         AND i.internal_name IS NOT NULL
         AND EXISTS (
             SELECT 1 FROM image_executor ie
             WHERE ie.image_ref = i.internal_name
             AND ie.state != $2
         )
         LIMIT $3",
    )
    .bind(ImageState::Inactive)
    .bind(ImageExecutorState::Removing)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn delete<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM image WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_build_details<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    internal_name: Option<&str>,
    size: Option<f32>,
    entrypoint: Option<&[String]>,
    build_executor_id: Option<&str>,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE image SET
            internal_name = COALESCE($1, internal_name),
            size = COALESCE($2, size),
            entrypoint = COALESCE($3, entrypoint),
            build_executor_id = COALESCE($4, build_executor_id),
            updated_at = now()
         WHERE id = $5",
    )
    .bind(internal_name)
    .bind(size)
    .bind(entrypoint)
    .bind(build_executor_id)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn find_by_state_and_organizations<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    state: ImageState,
    organization_ids: &[Uuid],
    limit: i64,
    offset: i64,
) -> sqlx::Result<Vec<Image>> {
    if organization_ids.is_empty() {
        return Ok(vec![]);
    }
    sqlx::query_as::<_, Image>(
        "SELECT * FROM image
         WHERE state = $1
         AND organization_id = ANY($2)
         ORDER BY created_at ASC
         LIMIT $3 OFFSET $4",
    )
    .bind(state)
    .bind(organization_ids)
    .bind(limit)
    .bind(offset)
    .fetch_all(db)
    .await
}

pub async fn find_in_processing_states<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Image>> {
    sqlx::query_as::<_, Image>(
        "SELECT * FROM image
         WHERE state NOT IN ($1, $2, $3, $4)",
    )
    .bind(ImageState::Active)
    .bind(ImageState::Error)
    .bind(ImageState::BuildFailed)
    .bind(ImageState::Inactive)
    .fetch_all(db)
    .await
}

pub async fn count_owned_by_organization<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM image WHERE organization_id = $1")
        .bind(organization_id)
        .fetch_one(db)
        .await
}

pub async fn find_non_general_with_internal_name_by_organizations<
    'e,
    E: sqlx::Executor<'e, Database = Postgres>,
>(
    db: E,
    organization_ids: &[Uuid],
) -> sqlx::Result<Vec<Image>> {
    if organization_ids.is_empty() {
        return Ok(vec![]);
    }
    sqlx::query_as::<_, Image>(
        "SELECT * FROM image
         WHERE general = false
         AND organization_id = ANY($1)
         AND internal_name IS NOT NULL",
    )
    .bind(organization_ids)
    .fetch_all(db)
    .await
}

pub async fn find_active_non_general_by_organizations<
    'e,
    E: sqlx::Executor<'e, Database = Postgres>,
>(
    db: E,
    organization_ids: &[Uuid],
    limit: i64,
) -> sqlx::Result<Vec<Image>> {
    if organization_ids.is_empty() {
        return Ok(vec![]);
    }
    sqlx::query_as::<_, Image>(
        "SELECT * FROM image
         WHERE organization_id = ANY($1)
         AND state = $2
         AND general = false
         LIMIT $3",
    )
    .bind(organization_ids)
    .bind(ImageState::Active)
    .bind(limit)
    .fetch_all(db)
    .await
}
