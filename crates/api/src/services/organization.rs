// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::DefaultOrganizationQuota;
use crate::constants::billing;
use crate::constants::org as org_constants;
use crate::constants::{lock_keys, lock_ttls};
use crate::infra::Infra;
use crate::infra::pending_usage;
use crate::models::{Organization, User};
use crate::repositories;
use crate::schemas::organization::{UpdateQuotaDto, UsageOverviewDto};
use crate::services::image;
use crate::services::sandbox;
use snapflow_errors::{AppError, Result};
use snapflow_models::{ImageExecutorState, OrganizationMemberRole};

pub async fn create(
    pool: &PgPool,
    name: &str,
    user: &User,
    quota: &DefaultOrganizationQuota,
) -> Result<Organization> {
    if !user.email_verified {
        return Err(AppError::Forbidden(
            "please verify your email before creating an organization".into(),
        ));
    }

    let count = repositories::organization::count_created_by(pool, user.id).await?;
    if count >= org_constants::MAX_CREATED_ORGS {
        let max = org_constants::MAX_CREATED_ORGS;
        return Err(AppError::BadRequest(format!(
            "maximum of {max} organizations per user"
        )));
    }

    let org = repositories::organization::create(pool, name, user.id, false, quota).await?;
    repositories::organization_user::create(pool, org.id, user.id, OrganizationMemberRole::Owner)
        .await?;

    Ok(org)
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Organization> {
    repositories::organization::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("organization not found".into()))
}

pub async fn find_by_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<Organization>> {
    Ok(repositories::organization::find_by_user(pool, user_id).await?)
}

pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
    let org = find_by_id(pool, id).await?;
    if org.personal {
        return Err(AppError::Forbidden(
            "cannot delete personal organization".into(),
        ));
    }
    repositories::organization::delete(pool, id).await?;
    Ok(())
}

pub async fn update_quota(pool: &PgPool, id: Uuid, dto: &UpdateQuotaDto) -> Result<Organization> {
    Ok(repositories::organization::update_quota(pool, id, dto).await?)
}

pub async fn suspend(
    pool: &PgPool,
    id: Uuid,
    reason: Option<&str>,
    until: Option<chrono::DateTime<chrono::Utc>>,
) -> Result<()> {
    repositories::organization::suspend(pool, id, reason, until).await?;
    Ok(())
}

pub async fn unsuspend(pool: &PgPool, id: Uuid) -> Result<Organization> {
    Ok(repositories::organization::unsuspend(pool, id).await?)
}

pub async fn get_usage_overview(infra: &Infra, id: Uuid) -> Result<UsageOverviewDto> {
    let org = find_by_id(&infra.pool, id).await?;
    let tier = billing::get_tier_for_balance(org.wallet_balance);
    let usage = repositories::organization::get_usage_summary(&infra.pool, id).await?;
    let image_count = repositories::image::count_owned_by_organization(&infra.pool, id)
        .await
        .unwrap_or(0);
    let bucket_count = repositories::bucket::count_by_organization(&infra.pool, id)
        .await
        .unwrap_or(0);

    let pending = pending_usage::get_pending(&mut infra.redis.clone(), id)
        .await
        .unwrap_or((0, 0, 0));

    Ok(UsageOverviewDto {
        total_cpu_quota: tier.max_concurrent_sandboxes * tier.max_cpu_per_sandbox,
        total_gpu_quota: 0,
        total_memory_quota: tier.max_concurrent_sandboxes * tier.max_memory_per_sandbox,
        total_disk_quota: tier.max_storage_total,
        current_cpu_usage: usage.0 + pending.0,
        current_gpu_usage: usage.1,
        current_memory_usage: usage.2 + pending.1,
        current_disk_usage: usage.3 + pending.2,
        total_image_quota: org.image_quota,
        current_image_usage: image_count,
        total_bucket_quota: tier.bucket_quota,
        current_bucket_usage: bucket_count,
    })
}

pub async fn stop_suspended_sandboxes(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::organization::STOP_SUSPENDED_SANDBOXES,
            lock_ttls::organization::STOP_SUSPENDED_SANDBOXES,
        )
        .await
    else {
        return;
    };

    let one_day_ago = Utc::now() - chrono::Duration::days(1);
    let seven_days_ago = Utc::now() - chrono::Duration::days(7);

    let suspended_orgs = match repositories::organization::find_suspended(
        &infra.pool,
        one_day_ago,
        seven_days_ago,
        100,
    )
    .await
    {
        Ok(orgs) => orgs,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch suspended organizations");
            if let Err(e) = lock
                .unlock(
                    lock_keys::organization::STOP_SUSPENDED_SANDBOXES,
                    &lock_code,
                )
                .await
            {
                tracing::warn!(error = %e, "failed to release lock");
            }
            return;
        }
    };

    let org_ids: Vec<Uuid> = suspended_orgs.iter().map(|o| o.id).collect();

    if org_ids.is_empty() {
        if let Err(e) = lock
            .unlock(
                lock_keys::organization::STOP_SUSPENDED_SANDBOXES,
                &lock_code,
            )
            .await
        {
            tracing::warn!(error = %e, "failed to release lock");
        }
        return;
    }

    let sandboxes =
        match repositories::sandbox::find_started_by_organizations(&infra.pool, &org_ids).await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(error = %e, "failed to fetch sandboxes for suspended orgs");
                if let Err(e) = lock
                    .unlock(
                        lock_keys::organization::STOP_SUSPENDED_SANDBOXES,
                        &lock_code,
                    )
                    .await
                {
                    tracing::warn!(error = %e, "failed to release lock");
                }
                return;
            }
        };

    for s in &sandboxes {
        sandbox::handle_suspended_sandbox_stop(infra, s.id).await;
    }

    if let Err(e) = lock
        .unlock(
            lock_keys::organization::STOP_SUSPENDED_SANDBOXES,
            &lock_code,
        )
        .await
    {
        tracing::warn!(error = %e, "failed to release lock");
    }
}

pub async fn remove_suspended_image_executors(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::organization::REMOVE_SUSPENDED_IMAGE_EXECUTORS,
            lock_ttls::organization::REMOVE_SUSPENDED_IMAGE_EXECUTORS,
        )
        .await
    else {
        return;
    };

    let one_day_ago = Utc::now() - chrono::Duration::days(1);
    let seven_days_ago = Utc::now() - chrono::Duration::days(7);

    let suspended_orgs = match repositories::organization::find_suspended(
        &infra.pool,
        one_day_ago,
        seven_days_ago,
        100,
    )
    .await
    {
        Ok(orgs) => orgs,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch suspended organizations");
            if let Err(e) = lock
                .unlock(
                    lock_keys::organization::REMOVE_SUSPENDED_IMAGE_EXECUTORS,
                    &lock_code,
                )
                .await
            {
                tracing::warn!(error = %e, "failed to release lock");
            }
            return;
        }
    };

    let org_ids: Vec<Uuid> = suspended_orgs.iter().map(|o| o.id).collect();

    if org_ids.is_empty() {
        if let Err(e) = lock
            .unlock(
                lock_keys::organization::REMOVE_SUSPENDED_IMAGE_EXECUTORS,
                &lock_code,
            )
            .await
        {
            tracing::warn!(error = %e, "failed to release lock");
        }
        return;
    }

    let images = match repositories::image::find_non_general_with_internal_name_by_organizations(
        &infra.pool,
        &org_ids,
    )
    .await
    {
        Ok(imgs) => imgs,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch images for suspended orgs");
            if let Err(e) = lock
                .unlock(
                    lock_keys::organization::REMOVE_SUSPENDED_IMAGE_EXECUTORS,
                    &lock_code,
                )
                .await
            {
                tracing::warn!(error = %e, "failed to release lock");
            }
            return;
        }
    };

    let image_refs: Vec<String> = images
        .iter()
        .filter_map(|img| img.internal_name.clone())
        .collect();

    if !image_refs.is_empty() {
        match repositories::executor::bulk_update_image_executor_state_by_refs(
            &infra.pool,
            &image_refs,
            ImageExecutorState::Removing,
        )
        .await
        {
            Ok(count) if count > 0 => {
                tracing::debug!(
                    count,
                    "marked image executors for removal from suspended organizations"
                );
            }
            Err(e) => {
                tracing::error!(
                    error = %e,
                    "failed to remove image executors for suspended organizations"
                );
            }
            _ => {}
        }
    }

    if let Err(e) = lock
        .unlock(
            lock_keys::organization::REMOVE_SUSPENDED_IMAGE_EXECUTORS,
            &lock_code,
        )
        .await
    {
        tracing::warn!(error = %e, "failed to release lock");
    }
}

pub async fn deactivate_suspended_images(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::organization::DEACTIVATE_SUSPENDED_IMAGES,
            lock_ttls::organization::DEACTIVATE_SUSPENDED_IMAGES,
        )
        .await
    else {
        return;
    };

    let one_day_ago = Utc::now() - chrono::Duration::days(1);
    let seven_days_ago = Utc::now() - chrono::Duration::days(7);

    let suspended_orgs = match repositories::organization::find_suspended(
        &infra.pool,
        one_day_ago,
        seven_days_ago,
        100,
    )
    .await
    {
        Ok(orgs) => orgs,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch suspended organizations");
            if let Err(e) = lock
                .unlock(
                    lock_keys::organization::DEACTIVATE_SUSPENDED_IMAGES,
                    &lock_code,
                )
                .await
            {
                tracing::warn!(error = %e, "failed to release lock");
            }
            return;
        }
    };

    let org_ids: Vec<Uuid> = suspended_orgs.iter().map(|o| o.id).collect();

    if org_ids.is_empty() {
        if let Err(e) = lock
            .unlock(
                lock_keys::organization::DEACTIVATE_SUSPENDED_IMAGES,
                &lock_code,
            )
            .await
        {
            tracing::warn!(error = %e, "failed to release lock");
        }
        return;
    }

    let images = match repositories::image::find_active_non_general_by_organizations(
        &infra.pool,
        &org_ids,
        100,
    )
    .await
    {
        Ok(imgs) => imgs,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch active images for suspended orgs");
            if let Err(e) = lock
                .unlock(
                    lock_keys::organization::DEACTIVATE_SUSPENDED_IMAGES,
                    &lock_code,
                )
                .await
            {
                tracing::warn!(error = %e, "failed to release lock");
            }
            return;
        }
    };

    for image in &images {
        if let Err(e) = image::deactivate_image(&infra.pool, image.id, &infra.realtime).await {
            tracing::error!(
                image_id = %image.id,
                error = %e,
                "error deactivating image from suspended organization"
            );
        }
    }

    if let Err(e) = lock
        .unlock(
            lock_keys::organization::DEACTIVATE_SUSPENDED_IMAGES,
            &lock_code,
        )
        .await
    {
        tracing::warn!(error = %e, "failed to release lock");
    }
}
