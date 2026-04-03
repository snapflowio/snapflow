// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;

use sqlx::PgPool;
use uuid::Uuid;

use crate::constants::lock_keys;
use crate::constants::lock_ttls;
use crate::constants::sandbox::WARM_POOL_UNASSIGNED_ORGANIZATION;
use crate::infra::Infra;
use crate::models::{Sandbox, WarmPool};
use crate::repositories;
use crate::repositories::sandbox::WarmPoolFilter;
use crate::repositories::warm_pool::WarmPoolMatchFilter;
use crate::services::sandbox;
use snapflow_errors::{AppError, Result};
use snapflow_models::SandboxClass;

pub struct FetchWarmPoolSandboxParams {
    pub image: String,
    pub target: String,
    pub class: SandboxClass,
    pub cpu: i32,
    pub mem: i32,
    pub disk: i32,
    pub os_user: String,
    pub env: HashMap<String, String>,
    pub organization_id: Uuid,
}

pub async fn fetch_warm_pool_sandbox(
    infra: &Infra,
    default_image: &str,
    params: &FetchWarmPoolSandboxParams,
) -> Result<Option<Sandbox>> {
    let lock = &infra.lock;

    let sandbox_image = if params.image.is_empty() {
        default_image
    } else {
        &params.image
    };

    let image = repositories::image::find_active_by_name(
        &infra.pool,
        sandbox_image,
        Some(params.organization_id),
    )
    .await?
    .ok_or(AppError::BadRequest(format!(
        "Image {sandbox_image} not found. Did you add it through the Snapflow dashboard?"
    )))?;

    let env_value = serde_json::to_value(&params.env)
        .map_err(|e| AppError::Internal(format!("failed to serialize env: {e}")))?;

    let warm_pool_item = repositories::warm_pool::find_matching(
        &infra.pool,
        &WarmPoolMatchFilter {
            image: &image.name,
            target: &params.target,
            class: params.class,
            cpu: params.cpu,
            mem: params.mem,
            disk: params.disk,
            os_user: &params.os_user,
            env: &env_value,
        },
    )
    .await?;

    let Some(warm_pool_item) = warm_pool_item else {
        return Ok(None);
    };

    let unschedulable_executors =
        repositories::executor::find_unschedulable_by_region(&infra.pool, &params.target).await?;

    let exclude_ids: Vec<Uuid> = unschedulable_executors.iter().map(|e| e.id).collect();

    let warm_pool_filter = WarmPoolFilter {
        organization_id: WARM_POOL_UNASSIGNED_ORGANIZATION,
        image: &image.name,
        region: &warm_pool_item.target,
        class: warm_pool_item.class,
        cpu: warm_pool_item.cpu,
        mem: warm_pool_item.mem,
        disk: warm_pool_item.disk,
        os_user: &warm_pool_item.os_user,
        env: &warm_pool_item.env,
    };

    let candidates = repositories::sandbox::find_started_by_warm_pool(
        &infra.pool,
        &warm_pool_filter,
        &exclude_ids,
        10,
    )
    .await?;

    for sandbox in candidates {
        let lock_key = lock_keys::warm_pool::sandbox(&sandbox.id.to_string());
        if let Ok(Some(_lock_code)) = lock.lock(&lock_key, lock_ttls::warm_pool::SANDBOX).await {
            return Ok(Some(sandbox));
        }
    }

    Ok(None)
}

pub async fn warm_pool_check(infra: &Infra) {
    let lock = &infra.lock;

    let warm_pool_items = match repositories::warm_pool::find_all(&infra.pool).await {
        Ok(items) => items,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch warm pool items");
            return;
        }
    };

    let futures: Vec<_> = warm_pool_items
        .iter()
        .map(|item| check_single_warm_pool_item(&infra.pool, lock, item))
        .collect();

    futures_util::future::join_all(futures).await;
}

async fn check_single_warm_pool_item(
    pool: &PgPool,
    lock: &crate::infra::lock::RedisLock,
    item: &WarmPool,
) {
    let lock_key = lock_keys::warm_pool::topup(&item.id.to_string());
    match lock.acquire(&lock_key, lock_ttls::warm_pool::TOPUP).await {
        Ok(Some(g)) => g,
        _ => return,
    };

    let filter = WarmPoolFilter {
        organization_id: WARM_POOL_UNASSIGNED_ORGANIZATION,
        image: &item.image,
        region: &item.target,
        class: item.class,
        cpu: item.cpu,
        mem: item.mem,
        disk: item.disk,
        os_user: &item.os_user,
        env: &item.env,
    };

    let sandbox_count = match repositories::sandbox::count_matching_warm_pool(
        pool, &filter, item.gpu,
    )
    .await
    {
        Ok(count) => count,
        Err(e) => {
            tracing::error!(warm_pool_id = %item.id, error = %e, "failed to count warm pool sandboxes");
            return;
        }
    };

    let missing = i64::from(item.pool) - sandbox_count;
    if missing > 0 {
        tracing::debug!(
            warm_pool_id = %item.id,
            missing,
            "warm pool needs top-up"
        );

        for _ in 0..missing {
            if let Err(e) = request_warm_pool_topup(pool, item).await {
                tracing::error!(
                    warm_pool_id = %item.id,
                    error = %e,
                    "failed to request warm pool top-up"
                );
            }
        }
    }
}

pub async fn handle_organization_updated(
    pool: &PgPool,
    sandbox: &Sandbox,
    new_organization_id: Uuid,
) {
    if new_organization_id == WARM_POOL_UNASSIGNED_ORGANIZATION {
        return;
    }

    let Some(ref image) = sandbox.image else {
        return;
    };

    let env_value = &sandbox.env;

    let warm_pool_item = match repositories::warm_pool::find_matching_with_gpu(
        pool,
        &WarmPoolMatchFilter {
            image,
            target: &sandbox.region,
            class: sandbox.class,
            cpu: sandbox.cpu,
            mem: sandbox.mem,
            disk: sandbox.disk,
            os_user: &sandbox.os_user,
            env: env_value,
        },
        sandbox.gpu,
    )
    .await
    {
        Ok(Some(item)) => item,
        _ => return,
    };

    let filter = WarmPoolFilter {
        organization_id: WARM_POOL_UNASSIGNED_ORGANIZATION,
        image,
        region: &sandbox.region,
        class: sandbox.class,
        cpu: sandbox.cpu,
        mem: sandbox.mem,
        disk: sandbox.disk,
        os_user: &sandbox.os_user,
        env: env_value,
    };

    let sandbox_count =
        match repositories::sandbox::count_matching_warm_pool(pool, &filter, sandbox.gpu).await {
            Ok(count) => count,
            Err(_) => return,
        };

    if i64::from(warm_pool_item.pool) <= sandbox_count {
        return;
    }

    if let Err(e) = request_warm_pool_topup(pool, &warm_pool_item).await {
        tracing::error!(
            warm_pool_id = %warm_pool_item.id,
            error = %e,
            "failed to request warm pool top-up after organization update"
        );
    }
}

async fn request_warm_pool_topup(pool: &PgPool, warm_pool_item: &WarmPool) -> Result<()> {
    sandbox::create_for_warm_pool(pool, warm_pool_item).await?;
    Ok(())
}
