// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::Postgres;
use uuid::Uuid;

use crate::models::WarmPool;
use snapflow_models::SandboxClass;

pub struct WarmPoolMatchFilter<'a> {
    pub image: &'a str,
    pub target: &'a str,
    pub class: SandboxClass,
    pub cpu: i32,
    pub mem: i32,
    pub disk: i32,
    pub os_user: &'a str,
    pub env: &'a serde_json::Value,
}

pub async fn find_all<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
) -> sqlx::Result<Vec<WarmPool>> {
    sqlx::query_as::<_, WarmPool>("SELECT * FROM warm_pool")
        .fetch_all(db)
        .await
}

pub async fn find_by_id<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    id: Uuid,
) -> sqlx::Result<Option<WarmPool>> {
    sqlx::query_as::<_, WarmPool>("SELECT * FROM warm_pool WHERE id = $1")
        .bind(id)
        .fetch_optional(db)
        .await
}

pub async fn find_matching<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    filter: &WarmPoolMatchFilter<'_>,
) -> sqlx::Result<Option<WarmPool>> {
    sqlx::query_as::<_, WarmPool>(
        "SELECT * FROM warm_pool
         WHERE image = $1
         AND target = $2
         AND class = $3
         AND cpu = $4
         AND mem = $5
         AND disk = $6
         AND os_user = $7
         AND env = $8
         AND pool > 0",
    )
    .bind(filter.image)
    .bind(filter.target)
    .bind(filter.class)
    .bind(filter.cpu)
    .bind(filter.mem)
    .bind(filter.disk)
    .bind(filter.os_user)
    .bind(filter.env)
    .fetch_optional(db)
    .await
}

pub async fn find_matching_with_gpu<'e, E: sqlx::Executor<'e, Database = Postgres>>(
    db: E,
    filter: &WarmPoolMatchFilter<'_>,
    gpu: i32,
) -> sqlx::Result<Option<WarmPool>> {
    sqlx::query_as::<_, WarmPool>(
        "SELECT * FROM warm_pool
         WHERE image = $1
         AND target = $2
         AND class = $3
         AND cpu = $4
         AND gpu = $5
         AND mem = $6
         AND disk = $7
         AND os_user = $8
         AND env = $9",
    )
    .bind(filter.image)
    .bind(filter.target)
    .bind(filter.class)
    .bind(filter.cpu)
    .bind(gpu)
    .bind(filter.mem)
    .bind(filter.disk)
    .bind(filter.os_user)
    .bind(filter.env)
    .fetch_optional(db)
    .await
}
