// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod auth;
pub mod backup;
pub mod billing;
pub mod bucket;
pub mod executor;
pub mod image;
pub mod organization;
pub mod sandbox;
pub mod usage;
pub mod warm_pool;

use std::sync::Arc;

use tokio_cron_scheduler::{Job, JobScheduler};

use crate::constants::schedules;
use crate::events::Event;
use crate::infra::Infra;
use crate::infra::docker::DockerClient;
use crate::services;
use crate::state::AppState;

macro_rules! schedule {
    ($scheduler:expr, $cron:expr, $name:expr, |$($dep:ident: $ty:ty),*| $body:expr) => {{
        $(let $dep = $dep.clone();)*
        $scheduler
            .add(Job::new_async($cron, move |_id, _jl| {
                $(let $dep = $dep.clone();)*
                Box::pin(async move { $body })
            })?)
            .await?;
        tracing::info!(schedule = $cron, concat!("scheduled ", $name));
    }};
}

pub async fn start(state: &AppState) -> anyhow::Result<()> {
    if state.infra.storage.is_none() {
        tracing::warn!("storage not configured, skipping job scheduler");
        return Ok(());
    }

    let scheduler = JobScheduler::new().await?;

    let pool = state.infra.pool.clone();
    let infra = state.infra.clone();
    let docker = state.infra.docker.clone();

    schedule_backup_jobs(&scheduler, &infra).await?;
    schedule_bucket_jobs(&scheduler, &infra).await?;
    schedule_executor_jobs(&scheduler, &infra).await?;
    schedule_image_jobs(&scheduler, &infra, &docker).await?;
    schedule_warm_pool_jobs(&scheduler, &infra).await?;
    schedule_sandbox_jobs(&scheduler, &pool, &infra).await?;
    schedule_organization_jobs(&scheduler, &infra).await?;
    schedule_usage_jobs(&scheduler, &infra).await?;
    schedule_billing_jobs(&scheduler, &infra).await?;
    schedule_auth_jobs(&scheduler, &pool).await?;

    schedule_event_listeners(state);

    scheduler.start().await?;
    tracing::info!("job scheduler started");
    Ok(())
}

fn schedule_event_listeners(state: &AppState) {
    let infra = state.infra.clone();
    let mut rx = state.infra.events.subscribe();

    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(Event::SandboxDestroyed { sandbox_id, .. }) => {
                    if let Ok(Some(sandbox)) =
                        crate::repositories::sandbox::find_by_id(&infra.pool, sandbox_id).await
                    {
                        services::registry::delete_sandbox_backup_repository(
                            &infra.pool,
                            sandbox_id,
                            sandbox.backup_registry_id,
                        )
                        .await;
                    }
                }
                Ok(Event::SandboxStateUpdated {
                    sandbox_id,
                    new_state,
                    ..
                }) => {
                    if let Ok(Some(sandbox)) =
                        crate::repositories::sandbox::find_by_id(&infra.pool, sandbox_id).await
                    {
                        services::usage::handle_sandbox_state_update(&infra, &sandbox, new_state)
                            .await;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    tracing::warn!(skipped = n, "event listener lagged behind");
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                _ => {}
            }
        }
    });
}

async fn schedule_backup_jobs(scheduler: &JobScheduler, infra: &Infra) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::backup::SYNC_PENDING,
        "backup:sync_pending",
        |infra: Infra| backup::sync_pending(&infra).await
    );

    schedule!(
        scheduler,
        schedules::backup::PROCESS_PENDING,
        "backup:process_pending",
        |infra: Infra| backup::process_pending(&infra).await
    );

    schedule!(
        scheduler,
        schedules::backup::CHECK_PROGRESS,
        "backup:check_progress",
        |infra: Infra| backup::check_progress(&infra).await
    );

    schedule!(
        scheduler,
        schedules::backup::AD_HOC_CHECK,
        "backup:ad_hoc_check",
        |infra: Infra| backup::ad_hoc_check(&infra).await
    );

    schedule!(
        scheduler,
        schedules::backup::SYNC_STOP_STATE,
        "backup:sync_stop_state",
        |infra: Infra| backup::sync_stop_state(&infra).await
    );

    Ok(())
}

async fn schedule_bucket_jobs(scheduler: &JobScheduler, infra: &Infra) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::bucket::PROCESS_PENDING,
        "bucket:process_pending",
        |infra: Infra| bucket::process_pending(&infra).await
    );

    Ok(())
}

async fn schedule_executor_jobs(scheduler: &JobScheduler, infra: &Infra) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::executor::HEALTH_CHECK,
        "executor:health_check",
        |infra: Infra| executor::health_check(&infra).await
    );

    Ok(())
}

async fn schedule_image_jobs(
    scheduler: &JobScheduler,
    infra: &Infra,
    docker: &Option<Arc<DockerClient>>,
) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::image::SYNC_EXECUTOR_IMAGES,
        "image:sync_executor_images",
        |infra: Infra| {
            image::sync_executor_images(&infra).await;
        }
    );

    schedule!(
        scheduler,
        schedules::image::SYNC_EXECUTOR_IMAGE_STATES,
        "image:sync_executor_image_states",
        |infra: Infra| image::sync_executor_image_states(&infra).await
    );

    schedule!(
        scheduler,
        schedules::image::CHECK_IMAGE_STATES,
        "image:check_image_states",
        |infra: Infra| {
            image::check_image_states(&infra).await;
        }
    );

    schedule!(
        scheduler,
        schedules::image::CHECK_IMAGE_CLEANUP,
        "image:check_image_cleanup",
        |infra: Infra| image::check_image_cleanup(&infra).await
    );

    schedule!(
        scheduler,
        schedules::image::CLEANUP_OLD_BUILD_INFO,
        "image:cleanup_old_build_info",
        |infra: Infra| image::cleanup_old_build_info(&infra).await
    );

    schedule!(
        scheduler,
        schedules::image::DEACTIVATE_OLD_IMAGES,
        "image:deactivate_old_images",
        |infra: Infra| image::deactivate_old_images(&infra).await
    );

    schedule!(
        scheduler,
        schedules::image::CLEANUP_INACTIVE_FROM_EXECUTORS,
        "image:cleanup_inactive_from_executors",
        |infra: Infra| image::cleanup_inactive_from_executors(&infra).await
    );

    if docker.is_some() {
        schedule!(
            scheduler,
            schedules::image::VALIDATE_IMAGE_RUNTIME,
            "image:cleanup_local_images",
            |docker: Option<Arc<DockerClient>>| {
                if let Some(ref d) = docker {
                    image::cleanup_local_images(d).await;
                }
            }
        );
    }

    Ok(())
}

async fn schedule_warm_pool_jobs(scheduler: &JobScheduler, infra: &Infra) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::warm_pool::CHECK,
        "warm_pool:check",
        |infra: Infra| warm_pool::check(&infra).await
    );

    Ok(())
}

async fn schedule_sandbox_jobs(
    scheduler: &JobScheduler,
    pool: &sqlx::PgPool,
    infra: &Infra,
) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::sandbox::CLEANUP_DESTROYED,
        "sandbox:cleanup_destroyed",
        |pool: sqlx::PgPool| sandbox::cleanup_destroyed(&pool).await
    );

    schedule!(
        scheduler,
        schedules::sandbox::HANDLE_UNSCHEDULABLE,
        "sandbox:handle_unschedulable_executors",
        |infra: Infra| sandbox::handle_unschedulable_executors(&infra).await
    );

    schedule!(
        scheduler,
        schedules::sandbox::SYNC_STATES,
        "sandbox:sync_states",
        |infra: Infra| sandbox::sync_states(&infra).await
    );

    schedule!(
        scheduler,
        schedules::sandbox::AUTO_STOP_CHECK,
        "sandbox:auto_stop_check",
        |infra: Infra| sandbox::auto_stop_check(&infra).await
    );

    schedule!(
        scheduler,
        schedules::sandbox::AUTO_ARCHIVE_CHECK,
        "sandbox:auto_archive_check",
        |infra: Infra| sandbox::auto_archive_check(&infra).await
    );

    schedule!(
        scheduler,
        schedules::sandbox::AUTO_DELETE_CHECK,
        "sandbox:auto_delete_check",
        |infra: Infra| sandbox::auto_delete_check(&infra).await
    );

    Ok(())
}

async fn schedule_usage_jobs(scheduler: &JobScheduler, infra: &Infra) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::usage::CLOSE_AND_REOPEN,
        "usage:close_and_reopen",
        |infra: Infra| usage::close_and_reopen(&infra).await
    );

    schedule!(
        scheduler,
        schedules::usage::ARCHIVE,
        "usage:archive",
        |infra: Infra| usage::archive(&infra).await
    );

    Ok(())
}

async fn schedule_billing_jobs(scheduler: &JobScheduler, infra: &Infra) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::billing::PROCESS_UNBILLED,
        "billing:process_unbilled",
        |infra: Infra| billing::process_unbilled_periods(&infra).await
    );

    schedule!(
        scheduler,
        schedules::billing::CHECK_ZERO_BALANCE,
        "billing:check_zero_balance",
        |infra: Infra| billing::check_zero_balance(&infra).await
    );

    schedule!(
        scheduler,
        schedules::billing::ENFORCE_TIER_COMPLIANCE,
        "billing:enforce_tier_compliance",
        |infra: Infra| billing::enforce_tier_compliance(&infra).await
    );

    schedule!(
        scheduler,
        schedules::billing::ENFORCE_SANDBOX_LIFETIME,
        "billing:enforce_sandbox_lifetime",
        |infra: Infra| billing::enforce_sandbox_lifetime(&infra).await
    );

    Ok(())
}

async fn schedule_auth_jobs(scheduler: &JobScheduler, pool: &sqlx::PgPool) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::auth::CLEANUP_EXPIRED,
        "auth:cleanup_expired",
        |pool: sqlx::PgPool| auth::cleanup_expired(&pool).await
    );

    Ok(())
}

async fn schedule_organization_jobs(scheduler: &JobScheduler, infra: &Infra) -> anyhow::Result<()> {
    schedule!(
        scheduler,
        schedules::organization::STOP_SUSPENDED_SANDBOXES,
        "organization:stop_suspended_sandboxes",
        |infra: Infra| organization::stop_suspended_sandboxes(&infra).await
    );

    schedule!(
        scheduler,
        schedules::organization::REMOVE_SUSPENDED_IMAGE_EXECUTORS,
        "organization:remove_suspended_image_executors",
        |infra: Infra| organization::remove_suspended_image_executors(&infra).await
    );

    schedule!(
        scheduler,
        schedules::organization::DEACTIVATE_SUSPENDED_IMAGES,
        "organization:deactivate_suspended_images",
        |infra: Infra| organization::deactivate_suspended_images(&infra).await
    );

    Ok(())
}
