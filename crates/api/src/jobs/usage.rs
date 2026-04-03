// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::Duration;
use chrono::Utc;

use crate::constants::sandbox::WARM_POOL_UNASSIGNED_ORGANIZATION;
use crate::constants::{lock_keys, lock_ttls};
use crate::infra::Infra;
use crate::repositories;
use snapflow_models::SandboxState;

const STALE_PERIOD_HOURS: i64 = 24;
const CLOSE_REOPEN_BATCH_SIZE: i64 = 100;
const ARCHIVE_BATCH_SIZE: i64 = 1000;

pub async fn close_and_reopen(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::usage::CLOSE_AND_REOPEN,
            lock_ttls::usage::CLOSE_AND_REOPEN,
        )
        .await
    else {
        return;
    };

    let cutoff = Utc::now() - Duration::hours(STALE_PERIOD_HOURS);

    let stale = match repositories::usage::find_stale_active_periods(
        &infra.pool,
        cutoff,
        WARM_POOL_UNASSIGNED_ORGANIZATION,
        CLOSE_REOPEN_BATCH_SIZE,
    )
    .await
    {
        Ok(periods) => periods,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch stale usage periods");
            unlock_warn(lock, lock_keys::usage::CLOSE_AND_REOPEN, &lock_code).await;
            return;
        }
    };

    for period in &stale {
        if let Err(e) = repositories::usage::close_period(&infra.pool, period.id).await {
            tracing::warn!(period_id = %period.id, error = %e, "failed to close stale usage period");
            continue;
        }

        let sandbox = match repositories::sandbox::find_by_id(&infra.pool, period.sandbox_id).await
        {
            Ok(Some(s)) => s,
            _ => continue,
        };

        let should_reopen = sandbox.state == SandboxState::Started;

        let is_disk_only = sandbox.state == SandboxState::Stopped;

        if should_reopen {
            if let Err(e) = repositories::usage::create_period(
                &infra.pool,
                period.sandbox_id,
                period.organization_id,
                period.cpu,
                period.gpu,
                period.mem,
                period.disk,
                &period.region,
            )
            .await
            {
                tracing::warn!(sandbox_id = %period.sandbox_id, error = %e, "failed to reopen usage period");
            }
        } else if is_disk_only {
            if let Err(e) = repositories::usage::create_period(
                &infra.pool,
                period.sandbox_id,
                period.organization_id,
                0.0,
                0.0,
                0.0,
                period.disk,
                &period.region,
            )
            .await
            {
                tracing::warn!(sandbox_id = %period.sandbox_id, error = %e, "failed to reopen disk-only usage period");
            }
        }
    }

    unlock_warn(lock, lock_keys::usage::CLOSE_AND_REOPEN, &lock_code).await;
}

pub async fn archive(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(lock_keys::usage::ARCHIVE, lock_ttls::usage::ARCHIVE)
        .await
    else {
        return;
    };

    let closed = match repositories::usage::find_billed_closed_periods(
        &infra.pool,
        ARCHIVE_BATCH_SIZE,
    )
    .await
    {
        Ok(periods) => periods,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch closed usage periods for archiving");
            unlock_warn(lock, lock_keys::usage::ARCHIVE, &lock_code).await;
            return;
        }
    };

    if !closed.is_empty() {
        let ids: Vec<_> = closed.iter().map(|p| p.id).collect();
        if let Err(e) = repositories::usage::archive_periods(&infra.pool, &ids).await {
            tracing::error!(count = ids.len(), error = %e, "failed to archive usage periods");
        } else {
            tracing::debug!(count = ids.len(), "archived usage periods");
        }
    }

    unlock_warn(lock, lock_keys::usage::ARCHIVE, &lock_code).await;
}

async fn unlock_warn(lock: &crate::infra::lock::RedisLock, key: &str, code: &str) {
    if let Err(e) = lock.unlock(key, code).await {
        tracing::warn!(key, error = %e, "failed to release lock");
    }
}
