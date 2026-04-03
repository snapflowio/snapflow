// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

use crate::config::DatabaseConfig;

pub async fn create_pool(config: &DatabaseConfig) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::default()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(300))
        .connect(&config.url)
        .await?;

    tracing::info!("database pool created");
    Ok(pool)
}

pub async fn run_migrations(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    tracing::info!("database migrations applied");
    Ok(())
}

pub async fn revert_migration(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").undo(pool, 1).await?;
    tracing::info!("last migration reverted");
    Ok(())
}
