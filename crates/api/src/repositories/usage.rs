// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use sqlx::Postgres;
use uuid::Uuid;

use crate::models::SandboxUsagePeriod;

pub async fn create_period<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    sandbox_id: Uuid,
    organization_id: Uuid,
    cpu: f64,
    gpu: f64,
    mem: f64,
    disk: f64,
    region: &str,
) -> sqlx::Result<SandboxUsagePeriod> {
    sqlx::query_as::<_, SandboxUsagePeriod>(
        "INSERT INTO sandbox_usage_period (sandbox_id, organization_id, start_at, cpu, gpu, mem, disk, region)
         VALUES ($1, $2, now(), $3, $4, $5, $6, $7)
         RETURNING *",
    )
    .bind(sandbox_id)
    .bind(organization_id)
    .bind(cpu)
    .bind(gpu)
    .bind(mem)
    .bind(disk)
    .bind(region)
    .fetch_one(db)
    .await
}

pub async fn close_active_periods<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    sandbox_id: Uuid,
) -> sqlx::Result<Vec<SandboxUsagePeriod>> {
    sqlx::query_as::<_, SandboxUsagePeriod>(
        "UPDATE sandbox_usage_period
         SET end_at = now()
         WHERE sandbox_id = $1 AND end_at IS NULL
         RETURNING *",
    )
    .bind(sandbox_id)
    .fetch_all(db)
    .await
}

pub async fn find_stale_active_periods<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    older_than: DateTime<Utc>,
    exclude_organization_id: Uuid,
    limit: i64,
) -> sqlx::Result<Vec<SandboxUsagePeriod>> {
    sqlx::query_as::<_, SandboxUsagePeriod>(
        "SELECT * FROM sandbox_usage_period
         WHERE end_at IS NULL AND start_at < $1 AND organization_id != $2
         ORDER BY start_at ASC
         LIMIT $3",
    )
    .bind(older_than)
    .bind(exclude_organization_id)
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn close_period<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE sandbox_usage_period SET end_at = now() WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn find_billed_closed_periods<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    limit: i64,
) -> sqlx::Result<Vec<SandboxUsagePeriod>> {
    sqlx::query_as::<_, SandboxUsagePeriod>(
        "SELECT * FROM sandbox_usage_period
         WHERE end_at IS NOT NULL AND billed = true
         ORDER BY end_at ASC
         LIMIT $1",
    )
    .bind(limit)
    .fetch_all(db)
    .await
}

pub async fn archive_periods(pool: &sqlx::PgPool, ids: &[Uuid]) -> sqlx::Result<()> {
    if ids.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;

    sqlx::query(
        "INSERT INTO sandbox_usage_period_archive (id, sandbox_id, organization_id, start_at, end_at, cpu, gpu, mem, disk, region, billed)
         SELECT id, sandbox_id, organization_id, start_at, end_at, cpu, gpu, mem, disk, region, billed
         FROM sandbox_usage_period
         WHERE id = ANY($1) AND end_at IS NOT NULL AND billed = true",
    )
    .bind(ids)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM sandbox_usage_period WHERE id = ANY($1) AND billed = true")
        .bind(ids)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}
