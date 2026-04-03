// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use sqlx::Postgres;

use crate::models::BuildInfo;

pub async fn find_by_ref<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    image_ref: &str,
) -> sqlx::Result<Option<BuildInfo>> {
    sqlx::query_as::<_, BuildInfo>("SELECT * FROM build_info WHERE image_ref = $1")
        .bind(image_ref)
        .fetch_optional(db)
        .await
}

pub async fn upsert<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    image_ref: &str,
    dockerfile_content: Option<&str>,
    context_hashes: Option<&[String]>,
) -> sqlx::Result<BuildInfo> {
    sqlx::query_as::<_, BuildInfo>(
        "INSERT INTO build_info (image_ref, dockerfile_content, context_hashes)
         VALUES ($1, $2, $3)
         ON CONFLICT (image_ref) DO UPDATE SET
            last_used_at = now(),
            updated_at = now()
         RETURNING *",
    )
    .bind(image_ref)
    .bind(dockerfile_content)
    .bind(context_hashes)
    .fetch_one(db)
    .await
}

pub async fn update_last_used<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    image_ref: &str,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE build_info SET last_used_at = now() WHERE image_ref = $1")
        .bind(image_ref)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn delete_unused_older_than<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    hours: i32,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "DELETE FROM build_info
         WHERE last_used_at < now() - make_interval(hours => $1)
         AND image_ref NOT IN (SELECT DISTINCT build_info_image_ref FROM image WHERE build_info_image_ref IS NOT NULL)
         AND image_ref NOT IN (SELECT DISTINCT build_info_image_ref FROM sandbox WHERE build_info_image_ref IS NOT NULL)",
    )
    .bind(hours)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}

pub async fn find_older_than<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    before: DateTime<Utc>,
) -> sqlx::Result<Vec<BuildInfo>> {
    sqlx::query_as::<_, BuildInfo>("SELECT * FROM build_info WHERE last_used_at < $1")
        .bind(before)
        .fetch_all(db)
        .await
}
