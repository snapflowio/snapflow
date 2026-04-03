// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::constants::sandbox::WARM_POOL_UNASSIGNED_ORGANIZATION;
use crate::models::Sandbox;
use snapflow_models::{BackupState, SandboxClass, SandboxDesiredState, SandboxState};

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<Sandbox>> {
    sqlx::query_as::<_, Sandbox>("SELECT * FROM sandbox WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_by_id_active<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<Sandbox>> {
    sqlx::query_as::<_, Sandbox>("SELECT * FROM sandbox WHERE id = $1 AND state != $2")
        .bind(id)
        .bind(SandboxState::Destroyed)
        .fetch_optional(db)
        .await
}

pub async fn find_by_organization<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE organization_id = $1
         AND (
             state NOT IN ($2, $3, $4)
             OR (state IN ($3, $4) AND desired_state != $2)
         )
         ORDER BY created_at DESC",
    )
    .bind(organization_id)
    .bind(SandboxState::Destroyed)
    .bind(SandboxState::Error)
    .bind(SandboxState::BuildFailed)
    .fetch_all(db)
    .await
}

pub async fn find_by_organization_with_labels<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    labels: &serde_json::Value,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE organization_id = $1
         AND labels @> $2
         AND (
             state NOT IN ($3, $4, $5)
             OR (state IN ($4, $5) AND desired_state != $3)
         )
         ORDER BY created_at DESC",
    )
    .bind(organization_id)
    .bind(labels)
    .bind(SandboxState::Destroyed)
    .bind(SandboxState::Error)
    .bind(SandboxState::BuildFailed)
    .fetch_all(db)
    .await
}

pub async fn find_by_organization_paginated<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    labels: Option<&serde_json::Value>,
    limit: i64,
    offset: i64,
) -> sqlx::Result<Vec<Sandbox>> {
    match labels {
        Some(l) => {
            sqlx::query_as::<_, Sandbox>(
                "SELECT * FROM sandbox
                 WHERE organization_id = $1
                 AND labels @> $2
                 AND (
                     state NOT IN ($3, $4, $5)
                     OR (state IN ($4, $5) AND desired_state != $3)
                 )
                 ORDER BY created_at DESC
                 LIMIT $6 OFFSET $7",
            )
            .bind(organization_id)
            .bind(l)
            .bind(SandboxState::Destroyed)
            .bind(SandboxState::Error)
            .bind(SandboxState::BuildFailed)
            .bind(limit)
            .bind(offset)
            .fetch_all(db)
            .await
        }
        None => {
            sqlx::query_as::<_, Sandbox>(
                "SELECT * FROM sandbox
                 WHERE organization_id = $1
                 AND (
                     state NOT IN ($2, $3, $4)
                     OR (state IN ($3, $4) AND desired_state != $2)
                 )
                 ORDER BY created_at DESC
                 LIMIT $5 OFFSET $6",
            )
            .bind(organization_id)
            .bind(SandboxState::Destroyed)
            .bind(SandboxState::Error)
            .bind(SandboxState::BuildFailed)
            .bind(limit)
            .bind(offset)
            .fetch_all(db)
            .await
        }
    }
}

pub async fn count_by_organization<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    labels: Option<&serde_json::Value>,
) -> sqlx::Result<i64> {
    match labels {
        Some(l) => {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM sandbox
                 WHERE organization_id = $1
                 AND labels @> $2
                 AND (
                     state NOT IN ($3, $4, $5)
                     OR (state IN ($4, $5) AND desired_state != $3)
                 )",
            )
            .bind(organization_id)
            .bind(l)
            .bind(SandboxState::Destroyed)
            .bind(SandboxState::Error)
            .bind(SandboxState::BuildFailed)
            .fetch_one(db)
            .await
        }
        None => {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM sandbox
                 WHERE organization_id = $1
                 AND (
                     state NOT IN ($2, $3, $4)
                     OR (state IN ($3, $4) AND desired_state != $2)
                 )",
            )
            .bind(organization_id)
            .bind(SandboxState::Destroyed)
            .bind(SandboxState::Error)
            .bind(SandboxState::BuildFailed)
            .fetch_one(db)
            .await
        }
    }
}

pub struct CreateSandboxParams<'a> {
    pub organization_id: Uuid,
    pub executor_id: Option<Uuid>,
    pub region: &'a str,
    pub class: SandboxClass,
    pub image: Option<&'a str>,
    pub os_user: &'a str,
    pub env: &'a serde_json::Value,
    pub labels: Option<&'a serde_json::Value>,
    pub public: bool,
    pub cpu: i32,
    pub gpu: i32,
    pub mem: i32,
    pub disk: i32,
    pub buckets: &'a serde_json::Value,
    pub auto_stop_interval: i32,
    pub auto_archive_interval: i32,
    pub auto_delete_interval: i32,
    pub auth_token: &'a str,
    pub build_info_image_ref: Option<&'a str>,
    pub network_block_all: bool,
    pub network_allow_list: Option<&'a str>,
}

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    params: &CreateSandboxParams<'_>,
) -> sqlx::Result<Sandbox> {
    sqlx::query_as::<_, Sandbox>(
        "INSERT INTO sandbox (
            organization_id, executor_id, region, class, state, desired_state,
            image, os_user, env, labels, public,
            cpu, gpu, mem, disk, buckets,
            auto_stop_interval, auto_archive_interval, auto_delete_interval,
            pending, auth_token, build_info_image_ref,
            network_block_all, network_allow_list
         ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, $18, $19,
            false, $20, $21,
            $22, $23
         ) RETURNING *",
    )
    .bind(params.organization_id)
    .bind(params.executor_id)
    .bind(params.region)
    .bind(params.class)
    .bind(SandboxState::Unknown)
    .bind(SandboxDesiredState::Started)
    .bind(params.image)
    .bind(params.os_user)
    .bind(params.env)
    .bind(params.labels)
    .bind(params.public)
    .bind(params.cpu)
    .bind(params.gpu)
    .bind(params.mem)
    .bind(params.disk)
    .bind(params.buckets)
    .bind(params.auto_stop_interval)
    .bind(params.auto_archive_interval)
    .bind(params.auto_delete_interval)
    .bind(params.auth_token)
    .bind(params.build_info_image_ref)
    .bind(params.network_block_all)
    .bind(params.network_allow_list)
    .fetch_one(db)
    .await
}

pub async fn update_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    new_state: SandboxState,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET state = $1, updated_at = now() WHERE id = $2")
        .bind(new_state)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_desired_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    desired_state: SandboxDesiredState,
    pending: bool,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE sandbox SET desired_state = $1, pending = $2, updated_at = now() WHERE id = $3",
    )
    .bind(desired_state)
    .bind(pending)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn update_desired_state_conditional<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    desired_state: SandboxDesiredState,
    expected_state: SandboxState,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "UPDATE sandbox SET desired_state = $1, pending = true, updated_at = now()
         WHERE id = $2 AND pending = false AND state = $3",
    )
    .bind(desired_state)
    .bind(id)
    .bind(expected_state)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}

pub async fn update_pending<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    pending: bool,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET pending = $1, updated_at = now() WHERE id = $2")
        .bind(pending)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_public<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    public: bool,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET public = $1, updated_at = now() WHERE id = $2")
        .bind(public)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_labels<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    labels: &serde_json::Value,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET labels = $1, updated_at = now() WHERE id = $2")
        .bind(labels)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_auto_stop_interval<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    interval: i32,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET auto_stop_interval = $1, updated_at = now() WHERE id = $2")
        .bind(interval)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_auto_delete_interval<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    interval: i32,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET auto_delete_interval = $1, updated_at = now() WHERE id = $2")
        .bind(interval)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_last_activity<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET last_activity_at = now() WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_organization<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    organization_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET organization_id = $1, updated_at = now() WHERE id = $2")
        .bind(organization_id)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_executor<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    executor_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET executor_id = $1, updated_at = now() WHERE id = $2")
        .bind(executor_id)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_error_reason<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    error_reason: Option<&str>,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET error_reason = $1, updated_at = now() WHERE id = $2")
        .bind(error_reason)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_node_version<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    node_version: &str,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET node_version = $1, updated_at = now() WHERE id = $2")
        .bind(node_version)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_resources<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    cpu: i32,
    mem: i32,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET cpu = $1, mem = $2, updated_at = now() WHERE id = $3")
        .bind(cpu)
        .bind(mem)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_image<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    image: &str,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET image = $1, updated_at = now() WHERE id = $2")
        .bind(image)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn find_by_backup_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    backup_state: BackupState,
    limit: i64,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE backup_state = $1
         AND state NOT IN ($2, $3, $4)
         ORDER BY CASE
             WHEN state = 'archiving' THEN 1
             WHEN state = 'stopped' THEN 2
             ELSE 3
         END, updated_at ASC
         LIMIT $5",
    )
    .bind(backup_state)
    .bind(SandboxState::Destroyed)
    .bind(SandboxState::Error)
    .bind(SandboxState::BuildFailed)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn find_needing_backup<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    limit: i64,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE organization_id != $1
         AND state IN ($2, $3)
         AND backup_state = $4
         AND auto_delete_interval != 0
         AND executor_id IS NOT NULL
         ORDER BY updated_at ASC
         LIMIT $5",
    )
    .bind(WARM_POOL_UNASSIGNED_ORGANIZATION)
    .bind(SandboxState::Archiving)
    .bind(SandboxState::Stopped)
    .bind(BackupState::None)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn update_backup_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    backup_state: BackupState,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET backup_state = $1, updated_at = now() WHERE id = $2")
        .bind(backup_state)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_backup_snapshot<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    backup_snapshot: Option<&str>,
    backup_registry_id: Option<Uuid>,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE sandbox SET backup_snapshot = $1, backup_registry_id = $2, last_backup_at = now(), updated_at = now() WHERE id = $3",
    )
    .bind(backup_snapshot)
    .bind(backup_registry_id)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn update_backup_error_reason<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    reason: Option<&str>,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET backup_error_reason = $1, updated_at = now() WHERE id = $2")
        .bind(reason)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn append_existing_backup_snapshot<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    image_name: &str,
) -> sqlx::Result<()> {
    let entry = serde_json::json!({
        "imageName": image_name,
        "createdAt": chrono::Utc::now().to_rfc3339()
    });
    sqlx::query(
        "UPDATE sandbox SET existing_backup_snapshots = existing_backup_snapshots || $1::jsonb, updated_at = now() WHERE id = $2",
    )
    .bind(entry)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn count_backups_on_executor<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    executor_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sandbox
         WHERE executor_id = $1
         AND backup_state = $2",
    )
    .bind(executor_id)
    .bind(BackupState::InProgress)
    .fetch_one(db)
    .await
}

pub async fn find_ad_hoc_backup_candidates<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    limit: i64,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE state = $1
         AND desired_state = $2
         AND backup_state IN ($3, $4)
         AND auto_delete_interval != 0
         AND (last_backup_at IS NULL OR last_backup_at < now() - interval '1 hour')
         AND organization_id != $5
         AND executor_id IS NOT NULL
         ORDER BY last_backup_at ASC NULLS FIRST
         LIMIT $6",
    )
    .bind(SandboxState::Started)
    .bind(SandboxDesiredState::Started)
    .bind(BackupState::None)
    .bind(BackupState::Completed)
    .bind(crate::constants::sandbox::WARM_POOL_UNASSIGNED_ORGANIZATION)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn update_existing_backup_snapshots<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    snapshots: &serde_json::Value,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE sandbox SET existing_backup_snapshots = $1, updated_at = now() WHERE id = $2",
    )
    .bind(snapshots)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn clear_executor_for_archive<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE sandbox SET prev_executor_id = executor_id, executor_id = NULL, updated_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn update_last_backup_at<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET last_backup_at = now(), updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn clear_prev_executor<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET prev_executor_id = NULL, updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn get_quota_usage<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    exclude_sandbox_id: Option<Uuid>,
) -> sqlx::Result<(i64, i64, i64)> {
    match exclude_sandbox_id {
        Some(exclude_id) => {
            sqlx::query_as::<_, (i64, i64, i64)>(
                "SELECT
                    COALESCE(SUM(CASE WHEN state NOT IN ($2, $3, $4) THEN disk ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN state NOT IN ($2, $3, $4, $5) THEN cpu ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN state NOT IN ($2, $3, $4, $5) THEN mem ELSE 0 END), 0)
                 FROM sandbox
                 WHERE organization_id = $1 AND id != $6",
            )
            .bind(organization_id)
            .bind(SandboxState::Destroyed)
            .bind(SandboxState::Error)
            .bind(SandboxState::BuildFailed)
            .bind(SandboxState::Stopped)
            .bind(exclude_id)
            .fetch_one(db)
            .await
        }
        None => {
            sqlx::query_as::<_, (i64, i64, i64)>(
                "SELECT
                    COALESCE(SUM(CASE WHEN state NOT IN ($2, $3, $4) THEN disk ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN state NOT IN ($2, $3, $4, $5) THEN cpu ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN state NOT IN ($2, $3, $4, $5) THEN mem ELSE 0 END), 0)
                 FROM sandbox
                 WHERE organization_id = $1",
            )
            .bind(organization_id)
            .bind(SandboxState::Destroyed)
            .bind(SandboxState::Error)
            .bind(SandboxState::BuildFailed)
            .bind(SandboxState::Stopped)
            .fetch_one(db)
            .await
        }
    }
}

pub async fn count_active_by_executor<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    executor_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sandbox
         WHERE executor_id = $1
         AND state NOT IN ($2, $3, $4, $5)",
    )
    .bind(executor_id)
    .bind(SandboxState::Destroyed)
    .bind(SandboxState::Stopped)
    .bind(SandboxState::BuildFailed)
    .bind(SandboxState::PendingBuild)
    .fetch_one(db)
    .await
}

pub async fn delete_destroyed_older_than<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    hours: i32,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "DELETE FROM sandbox
         WHERE state = $1
         AND updated_at < now() - make_interval(hours => $2)",
    )
    .bind(SandboxState::Destroyed)
    .bind(hours)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}

pub async fn delete_build_failed_older_than<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    hours: i32,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "DELETE FROM sandbox
         WHERE state = $1
         AND desired_state = $2
         AND updated_at < now() - make_interval(hours => $3)",
    )
    .bind(SandboxState::BuildFailed)
    .bind(SandboxDesiredState::Destroyed)
    .bind(hours)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}

pub async fn find_by_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    sandbox_state: SandboxState,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>("SELECT * FROM sandbox WHERE state = $1")
        .bind(sandbox_state)
        .fetch_all(db)
        .await
}

pub async fn find_pending<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox WHERE pending = true ORDER BY created_at ASC",
    )
    .fetch_all(db)
    .await
}

pub async fn find_by_executor_and_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    executor_id: Uuid,
    sandbox_state: SandboxState,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>("SELECT * FROM sandbox WHERE executor_id = $1 AND state = $2")
        .bind(executor_id)
        .bind(sandbox_state)
        .fetch_all(db)
        .await
}

pub struct WarmPoolFilter<'a> {
    pub organization_id: Uuid,
    pub image: &'a str,
    pub region: &'a str,
    pub class: SandboxClass,
    pub cpu: i32,
    pub mem: i32,
    pub disk: i32,
    pub os_user: &'a str,
    pub env: &'a serde_json::Value,
}

pub async fn find_started_by_warm_pool<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    filter: &WarmPoolFilter<'_>,
    exclude_executor_ids: &[Uuid],
    limit: i64,
) -> sqlx::Result<Vec<Sandbox>> {
    if exclude_executor_ids.is_empty() {
        sqlx::query_as::<_, Sandbox>(
            "SELECT * FROM sandbox
             WHERE organization_id = $1
             AND image = $2
             AND region = $3
             AND class = $4
             AND cpu = $5
             AND mem = $6
             AND disk = $7
             AND os_user = $8
             AND env = $9
             AND state = $10
             ORDER BY created_at ASC
             LIMIT $11",
        )
        .bind(filter.organization_id)
        .bind(filter.image)
        .bind(filter.region)
        .bind(filter.class)
        .bind(filter.cpu)
        .bind(filter.mem)
        .bind(filter.disk)
        .bind(filter.os_user)
        .bind(filter.env)
        .bind(SandboxState::Started)
        .bind(limit)
        .fetch_all(db)
        .await
    } else {
        sqlx::query_as::<_, Sandbox>(
            "SELECT * FROM sandbox
             WHERE organization_id = $1
             AND image = $2
             AND region = $3
             AND class = $4
             AND cpu = $5
             AND mem = $6
             AND disk = $7
             AND os_user = $8
             AND env = $9
             AND state = $10
             AND executor_id != ALL($11)
             ORDER BY created_at ASC
             LIMIT $12",
        )
        .bind(filter.organization_id)
        .bind(filter.image)
        .bind(filter.region)
        .bind(filter.class)
        .bind(filter.cpu)
        .bind(filter.mem)
        .bind(filter.disk)
        .bind(filter.os_user)
        .bind(filter.env)
        .bind(SandboxState::Started)
        .bind(exclude_executor_ids)
        .bind(limit)
        .fetch_all(db)
        .await
    }
}

pub async fn count_matching_warm_pool<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    filter: &WarmPoolFilter<'_>,
    gpu: i32,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sandbox
         WHERE organization_id = $1
         AND image = $2
         AND region = $3
         AND class = $4
         AND cpu = $5
         AND gpu = $6
         AND mem = $7
         AND disk = $8
         AND os_user = $9
         AND env = $10
         AND desired_state = $11
         AND state NOT IN ($12, $13)",
    )
    .bind(filter.organization_id)
    .bind(filter.image)
    .bind(filter.region)
    .bind(filter.class)
    .bind(filter.cpu)
    .bind(gpu)
    .bind(filter.mem)
    .bind(filter.disk)
    .bind(filter.os_user)
    .bind(filter.env)
    .bind(SandboxState::Started)
    .bind(SandboxState::Error)
    .bind(SandboxState::BuildFailed)
    .fetch_one(db)
    .await
}

pub async fn find_executors_with_multiple_images_building<
    'e,
    E: sqlx::Executor<'e, Database = Postgres>,
>(
    db: E,
    max_count: i64,
) -> sqlx::Result<Vec<Uuid>> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT executor_id FROM sandbox
         WHERE state = $1
         AND build_info_image_ref IS NOT NULL
         AND executor_id IS NOT NULL
         GROUP BY executor_id
         HAVING COUNT(DISTINCT build_info_image_ref) > $2",
    )
    .bind(SandboxState::BuildingImage)
    .bind(max_count)
    .fetch_all(db)
    .await
}

pub async fn find_auto_stop_candidates<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    executor_id: Uuid,
    limit: i64,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE executor_id = $1
         AND organization_id != $2
         AND state = $3
         AND desired_state = $4
         AND pending != true
         AND auto_stop_interval != 0
         AND last_activity_at < now() - make_interval(mins => auto_stop_interval)
         ORDER BY last_activity_at ASC NULLS LAST
         LIMIT $5",
    )
    .bind(executor_id)
    .bind(WARM_POOL_UNASSIGNED_ORGANIZATION)
    .bind(SandboxState::Started)
    .bind(SandboxDesiredState::Started)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn find_auto_archive_candidates<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    executor_id: Uuid,
    limit: i64,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE executor_id = $1
         AND organization_id != $2
         AND state = $3
         AND desired_state = $4
         AND pending != true
         AND auto_archive_interval != 0
         AND last_activity_at < now() - make_interval(mins => auto_archive_interval)
         ORDER BY last_activity_at ASC NULLS LAST
         LIMIT $5",
    )
    .bind(executor_id)
    .bind(WARM_POOL_UNASSIGNED_ORGANIZATION)
    .bind(SandboxState::Stopped)
    .bind(SandboxDesiredState::Stopped)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn find_auto_delete_candidates<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    executor_id: Uuid,
    limit: i64,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE executor_id = $1
         AND organization_id != $2
         AND state = $3
         AND desired_state = $4
         AND pending != true
         AND auto_delete_interval >= 0
         AND last_activity_at < now() - make_interval(mins => auto_delete_interval)
         ORDER BY last_activity_at ASC NULLS LAST
         LIMIT $5",
    )
    .bind(executor_id)
    .bind(WARM_POOL_UNASSIGNED_ORGANIZATION)
    .bind(SandboxState::Stopped)
    .bind(SandboxDesiredState::Stopped)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn find_out_of_sync<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    limit: i64,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE pending = true
         AND state NOT IN ($1, $2, $3)
         ORDER BY updated_at ASC
         LIMIT $4",
    )
    .bind(SandboxState::Destroyed)
    .bind(SandboxState::Error)
    .bind(SandboxState::BuildFailed)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn find_warm_pool_by_executors<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    executor_ids: &[Uuid],
) -> sqlx::Result<Vec<Sandbox>> {
    if executor_ids.is_empty() {
        return Ok(vec![]);
    }
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE executor_id = ANY($1)
         AND organization_id = $2
         AND state = $3
         AND desired_state != $4",
    )
    .bind(executor_ids)
    .bind(WARM_POOL_UNASSIGNED_ORGANIZATION)
    .bind(SandboxState::Started)
    .bind(SandboxState::Destroyed)
    .fetch_all(db)
    .await
}

pub async fn update_prev_executor<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    prev_executor_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET prev_executor_id = $1, updated_at = now() WHERE id = $2")
        .bind(prev_executor_id)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_executor_to_null<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox SET executor_id = NULL, updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn find_started_by_organizations<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_ids: &[Uuid],
) -> sqlx::Result<Vec<Sandbox>> {
    if organization_ids.is_empty() {
        return Ok(vec![]);
    }
    sqlx::query_as::<_, Sandbox>(
        "SELECT * FROM sandbox
         WHERE organization_id = ANY($1)
         AND desired_state = $2
         AND state NOT IN ($3, $4)",
    )
    .bind(organization_ids)
    .bind(SandboxDesiredState::Started)
    .bind(SandboxState::Error)
    .bind(SandboxState::BuildFailed)
    .fetch_all(db)
    .await
}

pub async fn count_active_by_organization<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sandbox
         WHERE organization_id = $1 AND state NOT IN ($2, $3, $4)",
    )
    .bind(organization_id)
    .bind(SandboxState::Destroyed)
    .bind(SandboxState::Error)
    .bind(SandboxState::BuildFailed)
    .fetch_one(db)
    .await
}

pub async fn find_by_organization_and_state<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    organization_id: Uuid,
    state: SandboxState,
) -> sqlx::Result<Vec<Sandbox>> {
    sqlx::query_as::<_, Sandbox>("SELECT * FROM sandbox WHERE organization_id = $1 AND state = $2")
        .bind(organization_id)
        .bind(state)
        .fetch_all(db)
        .await
}
