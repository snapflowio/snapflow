// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use sqlx::Postgres;
use uuid::Uuid;

use crate::config::DefaultOrganizationQuota;
use crate::constants::org;
use crate::models::Organization;
use crate::schemas::organization::UpdateQuotaDto;
use snapflow_models::SandboxState;

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<Organization>> {
    sqlx::query_as::<_, Organization>("SELECT * FROM organization WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_by_user<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
) -> sqlx::Result<Vec<Organization>> {
    sqlx::query_as::<_, Organization>(
        "SELECT o.* FROM organization o
         INNER JOIN organization_user ou ON o.id = ou.organization_id
         WHERE ou.user_id = $1
         ORDER BY o.created_at ASC",
    )
    .bind(user_id)
    .fetch_all(db)
    .await
}

pub async fn count_created_by<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
) -> sqlx::Result<i64> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM organization WHERE created_by = $1")
        .bind(user_id)
        .fetch_one(db)
        .await
}

pub async fn create<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    name: &str,
    created_by: Uuid,
    personal: bool,
    quota: &DefaultOrganizationQuota,
) -> sqlx::Result<Organization> {
    sqlx::query_as::<_, Organization>(
        "INSERT INTO organization (
            name, created_by, personal,
            total_cpu_quota, total_memory_quota, total_disk_quota,
            max_cpu_per_sandbox, max_memory_per_sandbox, max_disk_per_sandbox,
            image_quota, max_image_size, bucket_quota
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *",
    )
    .bind(name)
    .bind(created_by)
    .bind(personal)
    .bind(quota.total_cpu_quota)
    .bind(quota.total_memory_quota)
    .bind(quota.total_disk_quota)
    .bind(quota.max_cpu_per_sandbox)
    .bind(quota.max_memory_per_sandbox)
    .bind(quota.max_disk_per_sandbox)
    .bind(quota.image_quota)
    .bind(quota.max_image_size)
    .bind(quota.bucket_quota)
    .fetch_one(db)
    .await
}

pub async fn create_personal<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
    quota: &DefaultOrganizationQuota,
) -> sqlx::Result<Organization> {
    sqlx::query_as::<_, Organization>(
        "INSERT INTO organization (
            name, created_by, personal,
            total_cpu_quota, total_memory_quota, total_disk_quota,
            max_cpu_per_sandbox, max_memory_per_sandbox, max_disk_per_sandbox,
            image_quota, max_image_size, bucket_quota,
            suspended, suspension_reason
        ) VALUES (
            $1, $2, true,
            $3, $4, $5, $6, $7, $8, $9, $10, $11,
            true, $12
        ) RETURNING *",
    )
    .bind(org::PERSONAL_NAME)
    .bind(user_id)
    .bind(quota.total_cpu_quota)
    .bind(quota.total_memory_quota)
    .bind(quota.total_disk_quota)
    .bind(quota.max_cpu_per_sandbox)
    .bind(quota.max_memory_per_sandbox)
    .bind(quota.max_disk_per_sandbox)
    .bind(quota.image_quota)
    .bind(quota.max_image_size)
    .bind(quota.bucket_quota)
    .bind(org::SUSPENDED_VERIFY_EMAIL)
    .fetch_one(db)
    .await
}

pub async fn find_personal<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
) -> sqlx::Result<Option<Organization>> {
    sqlx::query_as::<_, Organization>(
        "SELECT * FROM organization WHERE created_by = $1 AND personal = true",
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
}

pub async fn delete<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM organization WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn delete_personal<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM organization WHERE created_by = $1 AND personal = true")
        .bind(user_id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_quota<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    quota: &UpdateQuotaDto,
) -> sqlx::Result<Organization> {
    sqlx::query_as::<_, Organization>(
        "UPDATE organization SET
            total_cpu_quota = COALESCE($1, total_cpu_quota),
            total_memory_quota = COALESCE($2, total_memory_quota),
            total_disk_quota = COALESCE($3, total_disk_quota),
            max_cpu_per_sandbox = COALESCE($4, max_cpu_per_sandbox),
            max_memory_per_sandbox = COALESCE($5, max_memory_per_sandbox),
            max_disk_per_sandbox = COALESCE($6, max_disk_per_sandbox),
            max_image_size = COALESCE($7, max_image_size),
            image_quota = COALESCE($8, image_quota),
            bucket_quota = COALESCE($9, bucket_quota),
            updated_at = now()
         WHERE id = $10
         RETURNING *",
    )
    .bind(quota.total_cpu_quota)
    .bind(quota.total_memory_quota)
    .bind(quota.total_disk_quota)
    .bind(quota.max_cpu_per_sandbox)
    .bind(quota.max_memory_per_sandbox)
    .bind(quota.max_disk_per_sandbox)
    .bind(quota.max_image_size)
    .bind(quota.image_quota)
    .bind(quota.bucket_quota)
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn suspend<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
    reason: Option<&str>,
    until: Option<DateTime<Utc>>,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE organization
         SET suspended = true, suspended_at = now(), suspension_reason = $1, suspended_until = $2, updated_at = now()
         WHERE id = $3",
    )
    .bind(reason)
    .bind(until)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn unsuspend<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Organization> {
    sqlx::query_as::<_, Organization>(
        "UPDATE organization
         SET suspended = false, suspension_reason = NULL, suspended_at = NULL, suspended_until = NULL, updated_at = now()
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .fetch_one(db)
    .await
}

pub async fn unsuspend_personal<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE organization
         SET suspended = false, suspension_reason = NULL, suspended_at = NULL, updated_at = now()
         WHERE created_by = $1 AND personal = true",
    )
    .bind(user_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn remove_user_from_all_non_personal<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query(
        "DELETE FROM organization_user
         WHERE user_id = $1
         AND organization_id IN (
             SELECT id FROM organization WHERE personal = false
         )",
    )
    .bind(user_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn find_suspended<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    suspended_before: DateTime<Utc>,
    suspended_after: DateTime<Utc>,
    limit: i64,
) -> sqlx::Result<Vec<Organization>> {
    sqlx::query_as::<_, Organization>(
        "SELECT * FROM organization
         WHERE suspended = true
         AND (suspended_until IS NULL OR suspended_until > now())
         AND suspended_at < $1
         AND suspended_at > $2
         LIMIT $3",
    )
    .bind(suspended_before)
    .bind(suspended_after)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn find_non_suspended_ids<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Uuid>> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM organization WHERE suspended = false")
        .fetch_all(db)
        .await
}

pub async fn get_usage_summary<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<(i64, i64, i64, i64)> {
    sqlx::query_as::<_, (i64, i64, i64, i64)>(
        "SELECT
             COALESCE(SUM(CASE WHEN state IN ($2, $3, $4, $5, $6, $7) THEN cpu ELSE 0 END), 0),
             COALESCE(SUM(CASE WHEN state IN ($2, $3, $4, $5, $6, $7) THEN gpu ELSE 0 END), 0),
             COALESCE(SUM(CASE WHEN state IN ($2, $3, $4, $5, $6, $7) THEN mem ELSE 0 END), 0),
             COALESCE(SUM(CASE WHEN state IN ($2, $3, $4, $5, $6, $7, $8) THEN disk ELSE 0 END), 0)
         FROM sandbox
         WHERE organization_id = $1",
    )
    .bind(id)
    .bind(SandboxState::Started)
    .bind(SandboxState::Starting)
    .bind(SandboxState::Stopping)
    .bind(SandboxState::Creating)
    .bind(SandboxState::Restoring)
    .bind(SandboxState::Resizing)
    .bind(SandboxState::Stopped) // disk still allocated when stopped
    .fetch_one(db)
    .await
}

pub async fn find_all_with_started_sandboxes<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Organization>> {
    sqlx::query_as::<_, Organization>(
        "SELECT DISTINCT o.* FROM organization o
         INNER JOIN sandbox s ON s.organization_id = o.id AND s.state = $1",
    )
    .bind(SandboxState::Started)
    .fetch_all(db)
    .await
}

pub async fn find_with_depleted_balance<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<Organization>> {
    sqlx::query_as::<_, Organization>(
        "SELECT o.* FROM organization o
         WHERE o.wallet_balance <= 0
         AND EXISTS (SELECT 1 FROM wallet_transaction wt WHERE wt.organization_id = o.id)",
    )
    .fetch_all(db)
    .await
}
