// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::models::{Executor, ImageExecutor};
use snapflow_models::{ExecutorState, ImageExecutorState, SandboxClass};

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<Executor>> {
    sqlx::query_as::<_, Executor>("SELECT * FROM executor WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_all<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Executor>> {
    sqlx::query_as::<_, Executor>("SELECT * FROM executor")
        .fetch_all(db)
        .await
}

pub async fn find_by_ids<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    ids: &[Uuid],
) -> sqlx::Result<Vec<Executor>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    sqlx::query_as::<_, Executor>("SELECT * FROM executor WHERE id = ANY($1)")
        .bind(ids)
        .fetch_all(db)
        .await
}

pub struct CreateExecutorParams<'a> {
    pub domain: &'a str,
    pub api_url: &'a str,
    pub proxy_url: &'a str,
    pub api_key: &'a str,
    pub cpu: i32,
    pub memory_gib: i32,
    pub disk_gib: i32,
    pub gpu: i32,
    pub gpu_type: &'a str,
    pub class: &'a str,
    pub capacity: i32,
    pub region: &'a str,
    pub version: &'a str,
}

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    params: &CreateExecutorParams<'_>,
) -> sqlx::Result<Executor> {
    sqlx::query_as::<_, Executor>(
        "INSERT INTO executor (
            domain, api_url, proxy_url, api_key,
            cpu, memory_gib, disk_gib, gpu, gpu_type,
            class, capacity, used, region, state, version,
            current_cpu_usage_percentage, current_memory_usage_percentage,
            current_disk_usage_percentage, current_allocated_cpu,
            current_allocated_memory_gib, current_allocated_disk_gib,
            current_image_count, availability_score, unschedulable
         ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11, 0, $12, $13, $14,
            0, 0, 0, 0, 0, 0, 0, 0, false
         ) RETURNING *",
    )
    .bind(params.domain)
    .bind(params.api_url)
    .bind(params.proxy_url)
    .bind(params.api_key)
    .bind(params.cpu)
    .bind(params.memory_gib)
    .bind(params.disk_gib)
    .bind(params.gpu)
    .bind(params.gpu_type)
    .bind(params.class)
    .bind(params.capacity)
    .bind(params.region)
    .bind(ExecutorState::Initializing)
    .bind(params.version)
    .fetch_one(db)
    .await
}

pub async fn delete<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM executor WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    new_state: ExecutorState,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE executor SET state = $1, last_checked = now(), updated_at = now() WHERE id = $2",
    )
    .bind(new_state)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub struct UpdateStatusParams {
    pub current_cpu_usage_percentage: f32,
    pub current_memory_usage_percentage: f32,
    pub current_disk_usage_percentage: f32,
    pub current_allocated_cpu: i32,
    pub current_allocated_memory_gib: i32,
    pub current_allocated_disk_gib: i32,
    pub current_image_count: i32,
    pub availability_score: i32,
    pub version: String,
}

pub async fn update_status<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    params: &UpdateStatusParams,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE executor SET
            state = $1,
            last_checked = now(),
            current_cpu_usage_percentage = $2,
            current_memory_usage_percentage = $3,
            current_disk_usage_percentage = $4,
            current_allocated_cpu = $5,
            current_allocated_memory_gib = $6,
            current_allocated_disk_gib = $7,
            current_image_count = $8,
            availability_score = $9,
            version = $10,
            updated_at = now()
         WHERE id = $11",
    )
    .bind(ExecutorState::Ready)
    .bind(params.current_cpu_usage_percentage)
    .bind(params.current_memory_usage_percentage)
    .bind(params.current_disk_usage_percentage)
    .bind(params.current_allocated_cpu)
    .bind(params.current_allocated_memory_gib)
    .bind(params.current_allocated_disk_gib)
    .bind(params.current_image_count)
    .bind(params.availability_score)
    .bind(&params.version)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn update_used<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    used: i32,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE executor SET used = $1, updated_at = now() WHERE id = $2")
        .bind(used)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_unschedulable<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    unschedulable: bool,
) -> sqlx::Result<Executor> {
    sqlx::query_as::<_, Executor>(
        "UPDATE executor SET unschedulable = $1, updated_at = now()
         WHERE id = $2 RETURNING *",
    )
    .bind(unschedulable)
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn find_available<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    region: Option<&str>,
    class: Option<SandboxClass>,
    image_ref: Option<&str>,
    exclude_ids: &[Uuid],
) -> sqlx::Result<Vec<Executor>> {
    match image_ref {
        Some(img_ref) => {
            sqlx::query_as::<_, Executor>(
                "SELECT e.* FROM executor e
                 INNER JOIN image_executor ie ON ie.executor_id = e.id
                 WHERE e.state = $1
                 AND e.unschedulable = false
                 AND e.used < e.capacity
                 AND ie.image_ref = $2
                 AND ie.state = $3
                 AND ($4::text IS NULL OR e.region = $4)
                 AND ($5::text IS NULL OR e.class = $5)
                 AND e.id != ALL($6)
                 ORDER BY (e.used::float / GREATEST(e.capacity, 1)::float) ASC
                 LIMIT 10",
            )
            .bind(ExecutorState::Ready)
            .bind(img_ref)
            .bind(ImageExecutorState::Ready)
            .bind(region)
            .bind(class)
            .bind(exclude_ids)
            .fetch_all(db)
            .await
        }
        None => {
            sqlx::query_as::<_, Executor>(
                "SELECT * FROM executor
                 WHERE state = $1
                 AND unschedulable = false
                 AND used < capacity
                 AND ($2::text IS NULL OR region = $2)
                 AND ($3::text IS NULL OR class = $3)
                 AND id != ALL($4)
                 ORDER BY (used::float / GREATEST(capacity, 1)::float) ASC
                 LIMIT 10",
            )
            .bind(ExecutorState::Ready)
            .bind(region)
            .bind(class)
            .bind(exclude_ids)
            .fetch_all(db)
            .await
        }
    }
}

pub async fn find_unschedulable_by_region<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    region: &str,
) -> sqlx::Result<Vec<Executor>> {
    sqlx::query_as::<_, Executor>(
        "SELECT * FROM executor WHERE region = $1 AND unschedulable = true",
    )
    .bind(region)
    .fetch_all(db)
    .await
}

pub async fn find_all_unschedulable<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Executor>> {
    sqlx::query_as::<_, Executor>("SELECT * FROM executor WHERE unschedulable = true")
        .fetch_all(db)
        .await
}

pub async fn find_image_executor<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    executor_id: Uuid,
    image_ref: &str,
) -> sqlx::Result<Option<ImageExecutor>> {
    sqlx::query_as::<_, ImageExecutor>(
        "SELECT * FROM image_executor WHERE executor_id = $1 AND image_ref = $2",
    )
    .bind(executor_id)
    .bind(image_ref)
    .fetch_optional(db)
    .await
}

pub async fn find_image_executors_by_ref<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    image_ref: &str,
) -> sqlx::Result<Vec<ImageExecutor>> {
    sqlx::query_as::<_, ImageExecutor>(
        "SELECT * FROM image_executor
         WHERE image_ref = $1
         ORDER BY state ASC, created_at ASC",
    )
    .bind(image_ref)
    .fetch_all(db)
    .await
}

pub async fn find_image_executors_by_ref_active<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    image_ref: &str,
) -> sqlx::Result<Vec<ImageExecutor>> {
    sqlx::query_as::<_, ImageExecutor>(
        "SELECT * FROM image_executor
         WHERE image_ref = $1 AND state != $2",
    )
    .bind(image_ref)
    .bind(ImageExecutorState::Error)
    .fetch_all(db)
    .await
}

pub async fn create_image_executor<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    executor_id: Uuid,
    image_ref: &str,
    state: ImageExecutorState,
    error_reason: Option<&str>,
) -> sqlx::Result<ImageExecutor> {
    sqlx::query_as::<_, ImageExecutor>(
        "INSERT INTO image_executor (executor_id, image_ref, state, error_reason)
         VALUES ($1, $2, $3, $4)
         RETURNING *",
    )
    .bind(executor_id)
    .bind(image_ref)
    .bind(state)
    .bind(error_reason)
    .fetch_one(db)
    .await
}

pub async fn update_image_executor_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    image_ref: &str,
    new_state: ImageExecutorState,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "UPDATE image_executor SET state = $1, updated_at = now() WHERE image_ref = $2",
    )
    .bind(new_state)
    .bind(image_ref)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}

pub async fn bulk_update_image_executor_state_by_refs<
    'e,
    E: sqlx::Executor<'e, Database = Postgres>,
>(
    db: E,
    image_refs: &[String],
    new_state: ImageExecutorState,
) -> sqlx::Result<u64> {
    if image_refs.is_empty() {
        return Ok(0);
    }
    let result = sqlx::query(
        "UPDATE image_executor SET state = $1, updated_at = now()
         WHERE image_ref = ANY($2)",
    )
    .bind(new_state)
    .bind(image_refs)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}

pub async fn delete_image_executor<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM image_executor WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn delete_image_executors_by_ref<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    image_ref: &str,
) -> sqlx::Result<u64> {
    let result = sqlx::query("DELETE FROM image_executor WHERE image_ref = $1")
        .bind(image_ref)
        .execute(db)
        .await?;
    Ok(result.rows_affected())
}

pub async fn find_all_active<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Executor>> {
    sqlx::query_as::<_, Executor>("SELECT * FROM executor WHERE state != $1")
        .bind(ExecutorState::Decommissioned)
        .fetch_all(db)
        .await
}

pub async fn find_ready_schedulable<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Executor>> {
    sqlx::query_as::<_, Executor>(
        "SELECT * FROM executor WHERE state = $1 AND unschedulable = false",
    )
    .bind(ExecutorState::Ready)
    .fetch_all(db)
    .await
}

pub async fn find_image_executors_by_states<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    states: &[ImageExecutorState],
    limit: i64,
) -> sqlx::Result<Vec<ImageExecutor>> {
    if states.is_empty() {
        return Ok(vec![]);
    }
    sqlx::query_as::<_, ImageExecutor>(
        "SELECT * FROM image_executor
         WHERE state = ANY($1)
         ORDER BY created_at ASC
         LIMIT $2",
    )
    .bind(states)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn update_image_executor_error<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    new_state: ImageExecutorState,
    error_reason: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE image_executor SET state = $1, error_reason = $2, updated_at = now()
         WHERE id = $3",
    )
    .bind(new_state)
    .bind(error_reason)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}
