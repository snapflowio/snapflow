// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use sqlx::PgPool;
use uuid::Uuid;

use crate::constants::bucket as bucket_constants;
use crate::constants::lock_keys;
use crate::constants::lock_ttls;
use crate::infra::Infra;
use crate::infra::lock::RedisLock;
use crate::models::Bucket;
use crate::realtime::Realtime;
use crate::repositories;
use crate::schemas::sandbox::BucketDto;
use crate::services::storage::StorageClient;
use snapflow_errors::{AppError, Result};
use snapflow_models::BucketState;

pub async fn create(
    pool: &PgPool,
    organization_id: Uuid,
    created_by: Option<Uuid>,
    bucket_quota: i32,
    name: Option<&str>,
    realtime: &Realtime,
) -> Result<Bucket> {
    let active_count = repositories::bucket::count_active(pool, organization_id).await?;

    if active_count >= bucket_quota as i64 {
        return Err(AppError::Forbidden(format!(
            "bucket quota limit ({bucket_quota}) reached"
        )));
    }

    let bucket_name = match name {
        Some(n) if !n.is_empty() => n.to_owned(),
        _ => Uuid::new_v4().to_string(),
    };

    if repositories::bucket::find_by_name(pool, organization_id, &bucket_name)
        .await?
        .is_some()
    {
        return Err(AppError::BadRequest(format!(
            "bucket with name {bucket_name} already exists"
        )));
    }

    let bucket =
        repositories::bucket::create(pool, organization_id, created_by, &bucket_name, 0).await?;

    tracing::debug!(
        bucket_id = %bucket.id,
        organization_id = %organization_id,
        "created bucket"
    );

    realtime.bucket_created(organization_id, &BucketDto::from(&bucket));

    Ok(bucket)
}

pub async fn delete(pool: &PgPool, bucket_id: Uuid, realtime: &Realtime) -> Result<()> {
    let bucket = repositories::bucket::find_by_id(pool, bucket_id)
        .await?
        .ok_or(AppError::NotFound(format!(
            "bucket with id {bucket_id} not found"
        )))?;

    if bucket.state != BucketState::Ready {
        return Err(AppError::BadRequest(
            "bucket must be in 'ready' state to be deleted".into(),
        ));
    }

    let old_state = bucket.state;
    repositories::bucket::update_state(pool, bucket_id, BucketState::PendingDelete).await?;

    if let Some(org_id) = bucket.organization_id {
        let updated = BucketDto::from(&Bucket {
            state: BucketState::PendingDelete,
            ..bucket
        });
        realtime.bucket_state_updated(org_id, &updated, old_state, BucketState::PendingDelete);
    }

    tracing::debug!(bucket_id = %bucket_id, "marked bucket for deletion");
    Ok(())
}

pub async fn find_one(pool: &PgPool, bucket_id: Uuid) -> Result<Bucket> {
    repositories::bucket::find_by_id(pool, bucket_id)
        .await?
        .ok_or(AppError::NotFound(format!(
            "bucket with id {bucket_id} not found"
        )))
}

pub async fn find_all(
    pool: &PgPool,
    organization_id: Uuid,
    include_deleted: bool,
) -> Result<Vec<Bucket>> {
    let buckets =
        repositories::bucket::find_by_organization(pool, organization_id, include_deleted).await?;
    Ok(buckets)
}

pub async fn find_by_name(pool: &PgPool, organization_id: Uuid, name: &str) -> Result<Bucket> {
    repositories::bucket::find_by_name(pool, organization_id, name)
        .await?
        .ok_or(AppError::NotFound(format!(
            "bucket with name {name} not found"
        )))
}

pub async fn count_active(pool: &PgPool, organization_id: Uuid) -> Result<i64> {
    let count = repositories::bucket::count_active(pool, organization_id).await?;
    Ok(count)
}

pub async fn process_pending_buckets(infra: &Infra) -> Result<()> {
    let lock = &infra.lock;
    let storage = infra.require_storage()?;

    match lock
        .acquire(
            lock_keys::bucket::PROCESS_PENDING,
            lock_ttls::bucket::PROCESS_PENDING,
        )
        .await
    {
        Ok(Some(g)) => g,
        Ok(None) => return Ok(()),
        Err(e) => {
            tracing::warn!(error = %e, "skipping bucket processing, lock unavailable");
            return Ok(());
        }
    };

    let pending = repositories::bucket::find_pending(&infra.pool).await?;

    let futures: Vec<_> = pending
        .into_iter()
        .map(|bucket| {
            let infra = infra.clone();
            let storage = storage.clone();
            async move {
                process_single_bucket(&infra, &storage, bucket).await;
            }
        })
        .collect();

    futures_util::future::join_all(futures).await;

    Ok(())
}

async fn process_single_bucket(infra: &Infra, storage: &Arc<StorageClient>, bucket: Bucket) {
    {
        let processing = infra.bucket_processing.lock().await;
        if processing.contains(&bucket.id) {
            return;
        }
    }

    let pool = &infra.pool;
    let lock = &infra.lock;
    let realtime = &infra.realtime;
    let bucket_lock_key = lock_keys::bucket::state(&bucket.id.to_string());

    let lock_code = match lock.lock(&bucket_lock_key, lock_ttls::bucket::STATE).await {
        Ok(Some(code)) => code,
        _ => return,
    };

    {
        infra.bucket_processing.lock().await.insert(bucket.id);
    }

    let result = match bucket.state {
        BucketState::PendingCreate => {
            handle_pending_create(
                pool,
                lock,
                storage,
                realtime,
                &bucket,
                &bucket_lock_key,
                &lock_code,
            )
            .await
        }
        BucketState::PendingDelete => {
            handle_pending_delete(
                pool,
                lock,
                storage,
                realtime,
                &bucket,
                &bucket_lock_key,
                &lock_code,
            )
            .await
        }
        _ => Ok(()),
    };

    if let Err(e) = &result {
        tracing::error!(bucket_id = %bucket.id, error = %e, "error processing bucket");
        if let Err(db_err) = repositories::bucket::update_state_with_error(
            pool,
            bucket.id,
            BucketState::Error,
            &e.to_string(),
        )
        .await
        {
            tracing::warn!(bucket_id = %bucket.id, error = %db_err, "failed to persist bucket error state");
        }

        if let Some(org_id) = bucket.organization_id {
            broadcast_state_change(
                pool,
                realtime,
                bucket.id,
                org_id,
                bucket.state,
                BucketState::Error,
            )
            .await;
        }
    }

    infra.bucket_processing.lock().await.remove(&bucket.id);
    if let Err(e) = lock.unlock(&bucket_lock_key, &lock_code).await {
        tracing::warn!(error = %e, key = bucket_lock_key, "failed to release bucket lock");
    }
}

async fn broadcast_state_change(
    pool: &PgPool,
    realtime: &Realtime,
    bucket_id: Uuid,
    org_id: Uuid,
    old_state: BucketState,
    new_state: BucketState,
) {
    if let Ok(Some(updated)) = repositories::bucket::find_by_id(pool, bucket_id).await {
        realtime.bucket_state_updated(org_id, &BucketDto::from(&updated), old_state, new_state);
    }
}

async fn transition_state(
    pool: &PgPool,
    realtime: &Realtime,
    bucket_id: Uuid,
    org_id: Option<Uuid>,
    old_state: BucketState,
    new_state: BucketState,
) -> Result<()> {
    repositories::bucket::update_state(pool, bucket_id, new_state).await?;
    if let Some(org_id) = org_id {
        broadcast_state_change(pool, realtime, bucket_id, org_id, old_state, new_state).await;
    }
    Ok(())
}

async fn handle_pending_create(
    pool: &PgPool,
    lock: &RedisLock,
    storage: &Arc<StorageClient>,
    realtime: &Realtime,
    bucket: &Bucket,
    lock_key: &str,
    lock_code: &str,
) -> Result<()> {
    lock.refresh(lock_key, lock_ttls::bucket::STATE, lock_code)
        .await?;

    transition_state(
        pool,
        realtime,
        bucket.id,
        bucket.organization_id,
        BucketState::PendingCreate,
        BucketState::Creating,
    )
    .await?;

    lock.refresh(lock_key, lock_ttls::bucket::STATE, lock_code)
        .await?;

    let r2_name = bucket_constants::r2_bucket_name(&bucket.id);
    storage.create_r2_bucket(&r2_name).await?;

    lock.refresh(lock_key, lock_ttls::bucket::STATE, lock_code)
        .await?;

    transition_state(
        pool,
        realtime,
        bucket.id,
        bucket.organization_id,
        BucketState::Creating,
        BucketState::Ready,
    )
    .await?;

    tracing::debug!(bucket_id = %bucket.id, "bucket created successfully");
    Ok(())
}

async fn handle_pending_delete(
    pool: &PgPool,
    lock: &RedisLock,
    storage: &Arc<StorageClient>,
    realtime: &Realtime,
    bucket: &Bucket,
    lock_key: &str,
    lock_code: &str,
) -> Result<()> {
    lock.refresh(lock_key, lock_ttls::bucket::STATE, lock_code)
        .await?;

    transition_state(
        pool,
        realtime,
        bucket.id,
        bucket.organization_id,
        BucketState::PendingDelete,
        BucketState::Deleting,
    )
    .await?;

    lock.refresh(lock_key, lock_ttls::bucket::STATE, lock_code)
        .await?;

    let r2_name = bucket_constants::r2_bucket_name(&bucket.id);
    storage.delete_r2_bucket(&r2_name).await?;

    lock.refresh(lock_key, lock_ttls::bucket::STATE, lock_code)
        .await?;

    let deleted_name = bucket_constants::deleted_bucket_name(&bucket.name);

    if let Some(org_id) = bucket.organization_id
        && let Err(e) = repositories::bucket::delete_by_org_name_state(
            pool,
            org_id,
            &deleted_name,
            BucketState::Deleted,
        )
        .await
    {
        tracing::warn!(bucket_id = %bucket.id, error = %e, "failed to delete previous bucket record");
    }

    transition_state(
        pool,
        realtime,
        bucket.id,
        bucket.organization_id,
        BucketState::Deleting,
        BucketState::Deleted,
    )
    .await?;

    repositories::bucket::update_name(pool, bucket.id, &deleted_name).await?;

    tracing::debug!(bucket_id = %bucket.id, "bucket deleted successfully");
    Ok(())
}
