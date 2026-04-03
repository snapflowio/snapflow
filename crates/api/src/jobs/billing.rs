use chrono::Utc;

use crate::constants::billing::{calculate_period_cost, get_tier_for_balance};
use crate::constants::{lock_keys, lock_ttls};
use crate::infra::Infra;
use crate::models::SandboxUsagePeriod;
use crate::repositories;
use crate::services;
use snapflow_models::SandboxState;

const BILLING_BATCH_SIZE: i64 = 200;

pub async fn process_unbilled_periods(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::billing::PROCESS_UNBILLED,
            lock_ttls::billing::PROCESS_UNBILLED,
        )
        .await
    else {
        return;
    };

    let periods =
        match repositories::billing::find_unbilled_closed_periods(&infra.pool, BILLING_BATCH_SIZE)
            .await
        {
            Ok(p) => p,
            Err(e) => {
                tracing::error!(error = %e, "failed to fetch unbilled usage periods");
                unlock_warn(lock, lock_keys::billing::PROCESS_UNBILLED, &lock_code).await;
                return;
            }
        };

    for period in &periods {
        if let Err(e) = bill_period(&infra.pool, period).await {
            tracing::warn!(period_id = %period.id, error = %e, "failed to bill usage period");
            continue;
        }
    }

    if !periods.is_empty() {
        tracing::debug!(count = periods.len(), "processed unbilled usage periods");
    }

    unlock_warn(lock, lock_keys::billing::PROCESS_UNBILLED, &lock_code).await;
}

async fn bill_period(pool: &sqlx::PgPool, period: &SandboxUsagePeriod) -> anyhow::Result<()> {
    let end_at = period
        .end_at
        .ok_or_else(|| anyhow::anyhow!("period has no end_at"))?;

    let duration = (end_at - period.start_at).num_seconds() as f64;
    if duration <= 0.0 {
        repositories::billing::mark_period_billed(pool, period.id).await?;
        return Ok(());
    }

    let cost = calculate_period_cost(duration, period.cpu, period.gpu, period.mem, period.disk);

    if cost <= 0.0 {
        repositories::billing::mark_period_billed(pool, period.id).await?;
        return Ok(());
    }

    let description = format!(
        "Usage: {:.1}h CPU={} Mem={} Disk={}",
        duration / 3600.0,
        period.cpu,
        period.mem,
        period.disk
    );

    repositories::billing::deduct_and_mark_billed(
        pool,
        period.organization_id,
        cost,
        &description,
        Some(period.sandbox_id),
        period.id,
    )
    .await?;

    Ok(())
}

pub async fn check_zero_balance(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::billing::CHECK_ZERO_BALANCE,
            lock_ttls::billing::CHECK_ZERO_BALANCE,
        )
        .await
    else {
        return;
    };

    let orgs = match repositories::organization::find_with_depleted_balance(&infra.pool).await {
        Ok(o) => o,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch depleted-balance organizations");
            unlock_warn(lock, lock_keys::billing::CHECK_ZERO_BALANCE, &lock_code).await;
            return;
        }
    };

    for org in &orgs {
        let started_sandboxes = match repositories::sandbox::find_by_organization_and_state(
            &infra.pool,
            org.id,
            SandboxState::Started,
        )
        .await
        {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(org_id = %org.id, error = %e, "failed to fetch started sandboxes for depleted-balance org");
                continue;
            }
        };

        if started_sandboxes.is_empty() {
            continue;
        }

        tracing::info!(
            org_id = %org.id,
            balance = org.wallet_balance,
            count = started_sandboxes.len(),
            "stopping sandboxes due to depleted wallet balance"
        );

        for sandbox in &started_sandboxes {
            if let Err(e) = services::sandbox::stop(infra, sandbox.id).await {
                tracing::warn!(sandbox_id = %sandbox.id, org_id = %org.id, error = %e, "failed to stop sandbox for depleted-balance org");
            }
        }
    }

    unlock_warn(lock, lock_keys::billing::CHECK_ZERO_BALANCE, &lock_code).await;
}

pub async fn enforce_tier_compliance(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::billing::ENFORCE_TIER_COMPLIANCE,
            lock_ttls::billing::ENFORCE_TIER_COMPLIANCE,
        )
        .await
    else {
        return;
    };

    let orgs = match repositories::organization::find_all_with_started_sandboxes(&infra.pool).await
    {
        Ok(o) => o,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch orgs for tier compliance");
            unlock_warn(
                lock,
                lock_keys::billing::ENFORCE_TIER_COMPLIANCE,
                &lock_code,
            )
            .await;
            return;
        }
    };

    for org in &orgs {
        let tier = get_tier_for_balance(org.wallet_balance);

        let mut started_sandboxes = match repositories::sandbox::find_by_organization_and_state(
            &infra.pool,
            org.id,
            SandboxState::Started,
        )
        .await
        {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(org_id = %org.id, error = %e, "failed to fetch started sandboxes for tier compliance");
                continue;
            }
        };

        let max = tier.max_concurrent_sandboxes as usize;
        if started_sandboxes.len() <= max {
            continue;
        }

        // Sort by created_at descending — stop the newest ones first
        started_sandboxes.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        let excess = started_sandboxes.len() - max;
        tracing::info!(
            org_id = %org.id,
            tier = tier.name,
            running = started_sandboxes.len(),
            max,
            stopping = excess,
            "stopping excess sandboxes for tier compliance"
        );

        for sandbox in started_sandboxes.iter().take(excess) {
            if let Err(e) = services::sandbox::stop(infra, sandbox.id).await {
                tracing::warn!(sandbox_id = %sandbox.id, org_id = %org.id, error = %e, "failed to stop sandbox for tier compliance");
            }
        }
    }

    unlock_warn(
        lock,
        lock_keys::billing::ENFORCE_TIER_COMPLIANCE,
        &lock_code,
    )
    .await;
}

pub async fn enforce_sandbox_lifetime(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::billing::ENFORCE_SANDBOX_LIFETIME,
            lock_ttls::billing::ENFORCE_SANDBOX_LIFETIME,
        )
        .await
    else {
        return;
    };

    let orgs = match repositories::organization::find_all_with_started_sandboxes(&infra.pool).await
    {
        Ok(o) => o,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch orgs for lifetime enforcement");
            unlock_warn(
                lock,
                lock_keys::billing::ENFORCE_SANDBOX_LIFETIME,
                &lock_code,
            )
            .await;
            return;
        }
    };

    let now = Utc::now();

    for org in &orgs {
        let tier = get_tier_for_balance(org.wallet_balance);

        if tier.max_sandbox_lifetime_seconds < 0 {
            continue; // unlimited lifetime
        }

        let started_sandboxes = match repositories::sandbox::find_by_organization_and_state(
            &infra.pool,
            org.id,
            SandboxState::Started,
        )
        .await
        {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(org_id = %org.id, error = %e, "failed to fetch started sandboxes for lifetime enforcement");
                continue;
            }
        };

        for sandbox in &started_sandboxes {
            let age_seconds = (now - sandbox.created_at).num_seconds();
            if age_seconds > tier.max_sandbox_lifetime_seconds {
                tracing::info!(
                    sandbox_id = %sandbox.id,
                    org_id = %org.id,
                    tier = tier.name,
                    age_hours = age_seconds as f64 / 3600.0,
                    max_hours = tier.max_sandbox_lifetime_seconds as f64 / 3600.0,
                    "stopping sandbox exceeding tier lifetime"
                );

                if let Err(e) = services::sandbox::stop(infra, sandbox.id).await {
                    tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to stop sandbox for lifetime enforcement");
                }
            }
        }
    }

    unlock_warn(
        lock,
        lock_keys::billing::ENFORCE_SANDBOX_LIFETIME,
        &lock_code,
    )
    .await;
}

async fn unlock_warn(lock: &crate::infra::lock::RedisLock, key: &str, code: &str) {
    if let Err(e) = lock.unlock(key, code).await {
        tracing::warn!(key, error = %e, "failed to release lock");
    }
}
