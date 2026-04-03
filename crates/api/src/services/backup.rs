// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use uuid::Uuid;

use crate::constants::executor::MAX_CONCURRENT_BACKUPS_PER_EXECUTOR;
use crate::executor;
use crate::infra::Infra;
use crate::infra::lock::RedisLock;
use crate::models::Sandbox;
use crate::repositories;
use snapflow_errors::{AppError, Result};
use snapflow_models::{BackupState, RegistryType, SandboxDesiredState, SandboxState};

fn backup_image_name(registry: &crate::models::Registry, sandbox_id: Uuid) -> String {
    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let url = registry
        .url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    format!(
        "{}/{}/backup-{sandbox_id}:{timestamp}",
        url, registry.project
    )
}

pub async fn sync_pending_backups(infra: &Infra) {
    let lock = &infra.lock;
    let lock_key = "sync-pending-backups";
    let Ok(Some(lock_code)) = lock.lock(lock_key, 30).await else {
        return;
    };

    let sandboxes = match repositories::sandbox::find_needing_backup(&infra.pool, 100).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch sandboxes needing backup");
            unlock_warn(lock, lock_key, &lock_code).await;
            return;
        }
    };

    for sandbox in &sandboxes {
        let per_sandbox_lock_key = format!("sandbox-backup-{}", sandbox.id);
        let Ok(Some(per_sandbox_lock_code)) = lock.lock(&per_sandbox_lock_key, 60).await else {
            continue;
        };
        if let Err(e) = set_backup_pending(&infra.pool, sandbox).await {
            tracing::warn!(
                sandbox_id = %sandbox.id,
                error = %e,
                "failed to set backup pending"
            );
        }
        unlock_warn(lock, &per_sandbox_lock_key, &per_sandbox_lock_code).await;
    }

    unlock_warn(lock, lock_key, &lock_code).await;
}

pub async fn set_backup_pending(pool: &sqlx::PgPool, sandbox: &Sandbox) -> Result<()> {
    if sandbox.backup_state == BackupState::Completed {
        return Ok(());
    }

    if !matches!(
        sandbox.state,
        SandboxState::Started | SandboxState::Archiving
    ) && !(sandbox.state == SandboxState::Stopped && sandbox.executor_id.is_some())
    {
        return Err(AppError::BadRequest(
            "sandbox must be started or stopped with assigned executor to create a backup".into(),
        ));
    }

    if sandbox.backup_state == BackupState::InProgress {
        return Ok(());
    }

    if sandbox.backup_state == BackupState::Pending && sandbox.backup_snapshot.is_some() {
        return Ok(());
    }

    let registry = if let Some(registry_id) = sandbox.backup_registry_id {
        repositories::registry::find_by_id(pool, registry_id)
            .await?
            .ok_or_else(|| AppError::Internal("backup registry not found".into()))?
    } else {
        repositories::registry::find_default_by_type(pool, RegistryType::Internal)
            .await?
            .ok_or_else(|| {
                AppError::Internal("no internal registry configured for backups".into())
            })?
    };

    let image_name = backup_image_name(&registry, sandbox.id);

    let mut tx = pool.begin().await?;

    repositories::sandbox::update_backup_snapshot(
        &mut *tx,
        sandbox.id,
        Some(&image_name),
        Some(registry.id),
    )
    .await?;

    repositories::sandbox::update_backup_state(&mut *tx, sandbox.id, BackupState::Pending).await?;
    repositories::sandbox::update_backup_error_reason(&mut *tx, sandbox.id, None).await?;

    tx.commit().await?;

    tracing::debug!(sandbox_id = %sandbox.id, image = %image_name, "backup set to pending");
    Ok(())
}

pub async fn process_pending_backups(infra: &Infra) {
    let lock = &infra.lock;
    let lock_key = "process-pending-backups";
    let Ok(Some(lock_code)) = lock.lock(lock_key, 60).await else {
        return;
    };

    let sandboxes =
        match repositories::sandbox::find_by_backup_state(&infra.pool, BackupState::Pending, 50)
            .await
        {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(error = %e, "failed to fetch pending backups");
                unlock_warn(lock, lock_key, &lock_code).await;
                return;
            }
        };

    for sandbox in &sandboxes {
        let per_sandbox_lock_key = format!("sandbox-backup-{}", sandbox.id);
        let Ok(Some(per_sandbox_lock_code)) = lock.lock(&per_sandbox_lock_key, 60).await else {
            continue;
        };

        let mut fresh = if let Ok(Some(s)) = repositories::sandbox::find_by_id(&infra.pool, sandbox.id).await {
            s
        } else {
            unlock_warn(lock, &per_sandbox_lock_key, &per_sandbox_lock_code).await;
            continue;
        };

        if fresh.backup_state != BackupState::Pending {
            unlock_warn(lock, &per_sandbox_lock_key, &per_sandbox_lock_code).await;
            continue;
        }

        if fresh.backup_snapshot.is_none() {
            if let Err(e) = set_backup_pending(&infra.pool, &fresh).await {
                tracing::warn!(
                    sandbox_id = %sandbox.id,
                    error = %e,
                    "failed to assign backup image name"
                );
                unlock_warn(lock, &per_sandbox_lock_key, &per_sandbox_lock_code).await;
                continue;
            }
            fresh = if let Ok(Some(s)) = repositories::sandbox::find_by_id(&infra.pool, sandbox.id).await {
                s
            } else {
                unlock_warn(lock, &per_sandbox_lock_key, &per_sandbox_lock_code).await;
                continue;
            };
        }

        if let Err(e) = initiate_backup(infra, &fresh).await {
            tracing::warn!(
                sandbox_id = %sandbox.id,
                error = %e,
                "failed to initiate backup on executor"
            );
        }
        unlock_warn(lock, &per_sandbox_lock_key, &per_sandbox_lock_code).await;
    }

    unlock_warn(lock, lock_key, &lock_code).await;
}

async fn initiate_backup(infra: &Infra, sandbox: &Sandbox) -> Result<()> {
    let lock = &infra.lock;
    let executor_id = sandbox
        .executor_id
        .ok_or_else(|| AppError::Internal("sandbox has no executor for backup".into()))?;

    let exec = repositories::executor::find_by_id(&infra.pool, executor_id)
        .await?
        .ok_or_else(|| AppError::entity_not_found("executor", executor_id))?;

    let adapter = executor::create_adapter(&exec)?;

    let executor_lock_key = format!("executor-{executor_id}-backup-lock");
    let executor_lock_guard = lock
        .acquire_wait_timeout(&executor_lock_key, 10, std::time::Duration::from_secs(30))
        .await?;
    let _guard = executor_lock_guard;

    let concurrent =
        repositories::sandbox::count_backups_on_executor(&infra.pool, executor_id).await?;
    if concurrent >= MAX_CONCURRENT_BACKUPS_PER_EXECUTOR {
        tracing::debug!(
            executor_id = %executor_id,
            concurrent,
            "skipping backup: executor at concurrent backup limit"
        );
        return Ok(());
    }

    let backup_image = sandbox
        .backup_snapshot
        .as_deref()
        .ok_or_else(|| AppError::Internal("sandbox has no backup image name set".into()))?;

    let registry = if let Some(registry_id) = sandbox.backup_registry_id {
        repositories::registry::find_by_id(&infra.pool, registry_id).await?
    } else {
        None
    };

    match adapter.sandbox_info(&sandbox.id.to_string()).await {
        Ok(info) => {
            if info.backup_state == BackupState::InProgress {
                repositories::sandbox::update_backup_state(
                    &infra.pool,
                    sandbox.id,
                    BackupState::InProgress,
                )
                .await?;
                return Ok(());
            }
        }
        Err(e) => {
            tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to check sandbox info before backup");
        }
    }

    if let Err(e) = adapter
        .create_backup(&sandbox.id.to_string(), backup_image, registry.as_ref())
        .await
    {
        let msg = e.to_string();
        if msg.contains("A backup is already in progress") || msg.contains("already in progress") {
            repositories::sandbox::update_backup_state(
                &infra.pool,
                sandbox.id,
                BackupState::InProgress,
            )
            .await?;
            return Ok(());
        }

        repositories::sandbox::update_backup_state(&infra.pool, sandbox.id, BackupState::Failed)
            .await?;
        repositories::sandbox::update_backup_error_reason(&infra.pool, sandbox.id, Some(&msg))
            .await?;
        return Err(e);
    }

    repositories::sandbox::update_backup_state(&infra.pool, sandbox.id, BackupState::InProgress)
        .await?;

    tracing::info!(sandbox_id = %sandbox.id, image = %backup_image, "backup initiated on executor");
    Ok(())
}

pub async fn check_backup_progress(infra: &Infra) {
    let lock = &infra.lock;
    let lock_key = "check-backup-progress";
    let Ok(Some(lock_code)) = lock.lock(lock_key, 30).await else {
        return;
    };

    let sandboxes = match repositories::sandbox::find_by_backup_state(
        &infra.pool,
        BackupState::InProgress,
        100,
    )
    .await
    {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch in-progress backups");
            unlock_warn(lock, lock_key, &lock_code).await;
            return;
        }
    };

    for sandbox in &sandboxes {
        let per_sandbox_lock_key = format!("sandbox-backup-{}", sandbox.id);
        let Ok(Some(per_sandbox_lock_code)) = lock.lock(&per_sandbox_lock_key, 60).await else {
            continue;
        };

        if let Err(e) = poll_backup_state(infra, sandbox).await {
            tracing::warn!(
                sandbox_id = %sandbox.id,
                error = %e,
                "failed to poll backup state from executor"
            );
        }

        unlock_warn(lock, &per_sandbox_lock_key, &per_sandbox_lock_code).await;
    }

    unlock_warn(lock, lock_key, &lock_code).await;
}

async fn poll_backup_state(infra: &Infra, sandbox: &Sandbox) -> Result<()> {
    let lock = &infra.lock;
    let executor_id = sandbox
        .executor_id
        .ok_or_else(|| AppError::Internal("sandbox has no executor".into()))?;

    let exec = repositories::executor::find_by_id(&infra.pool, executor_id)
        .await?
        .ok_or_else(|| AppError::entity_not_found("executor", executor_id))?;

    let adapter = executor::create_adapter(&exec)?;
    let info = match adapter.sandbox_info(&sandbox.id.to_string()).await {
        Ok(info) => info,
        Err(e) => {
            let error_retry_key = format!("sandbox-backup-{}-error-retry", sandbox.id);
            let retry_count = lock.get_counter(&error_retry_key).await.unwrap_or(0);
            if retry_count > 10 {
                tracing::error!(sandbox_id = %sandbox.id, error = %e, "backup progress check failed after 10 retries");
                repositories::sandbox::update_backup_state(
                    &infra.pool,
                    sandbox.id,
                    BackupState::Failed,
                )
                .await?;
                repositories::sandbox::update_backup_error_reason(
                    &infra.pool,
                    sandbox.id,
                    Some(&e.to_string()),
                )
                .await?;
                if let Err(e) = lock.force_unlock(&error_retry_key).await {
                    tracing::warn!(error = %e, key = %error_retry_key, "failed to force unlock error retry key");
                }
            } else if let Err(e) = lock.increment_counter(&error_retry_key, 300).await {
                tracing::warn!(error = %e, key = %error_retry_key, "failed to increment error retry counter");
            }
            return Err(e);
        }
    };

    match info.backup_state {
        BackupState::Completed => {
            let mut tx = infra.pool.begin().await?;

            repositories::sandbox::update_backup_state(
                &mut *tx,
                sandbox.id,
                BackupState::Completed,
            )
            .await?;
            repositories::sandbox::update_last_backup_at(&mut *tx, sandbox.id).await?;
            repositories::sandbox::update_backup_error_reason(&mut *tx, sandbox.id, None).await?;

            if let Some(ref snapshot) = sandbox.backup_snapshot {
                repositories::sandbox::append_existing_backup_snapshot(
                    &mut *tx, sandbox.id, snapshot,
                )
                .await?;
            }

            if sandbox.desired_state == SandboxDesiredState::Archived
                && matches!(
                    sandbox.state,
                    SandboxState::Archiving | SandboxState::Stopped
                )
            {
                repositories::sandbox::update_state(&mut *tx, sandbox.id, SandboxState::Archived)
                    .await?;
                repositories::sandbox::update_executor_to_null(&mut *tx, sandbox.id).await?;
                repositories::sandbox::update_pending(&mut *tx, sandbox.id, false).await?;

                tracing::info!(
                    sandbox_id = %sandbox.id,
                    "backup completed, auto-transitioned to archived"
                );
            } else {
                tracing::info!(sandbox_id = %sandbox.id, "backup completed");
            }

            tx.commit().await?;

            let error_retry_key = format!("sandbox-backup-{}-error-retry", sandbox.id);
            if let Err(e) = lock.force_unlock(&error_retry_key).await {
                tracing::warn!(error = %e, key = %error_retry_key, "failed to clear error retry key");
            }
        }
        BackupState::Failed => {
            let reason = info.backup_error.as_deref().unwrap_or("unknown error");
            tracing::error!(sandbox_id = %sandbox.id, reason, "backup failed on executor");
            repositories::sandbox::update_backup_state(
                &infra.pool,
                sandbox.id,
                BackupState::Failed,
            )
            .await?;
            repositories::sandbox::update_backup_error_reason(
                &infra.pool,
                sandbox.id,
                Some(reason),
            )
            .await?;
        }
        BackupState::None => {
            tracing::warn!(sandbox_id = %sandbox.id, "executor reports no backup state, retrying");
            repositories::sandbox::update_backup_state(
                &infra.pool,
                sandbox.id,
                BackupState::Pending,
            )
            .await?;
        }
        _ => {}
    }

    Ok(())
}

pub async fn sync_stop_state_create_backups(infra: &Infra) {
    let lock = &infra.lock;
    let lock_key = "sync-stop-state-create-backups";
    let Ok(Some(lock_code)) = lock.lock(lock_key, 30).await else {
        return;
    };

    let sandboxes = match repositories::sandbox::find_needing_backup(&infra.pool, 100).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch sandboxes needing stop-state backup");
            unlock_warn(lock, lock_key, &lock_code).await;
            return;
        }
    };

    for sandbox in &sandboxes {
        let per_sandbox_lock_key = format!("sandbox-backup-{}", sandbox.id);
        let Ok(Some(per_sandbox_lock_code)) = lock.lock(&per_sandbox_lock_key, 60).await else {
            continue;
        };
        if let Err(e) = set_backup_pending(&infra.pool, sandbox).await {
            tracing::warn!(
                sandbox_id = %sandbox.id,
                error = %e,
                "failed to set stop-state backup pending"
            );
        }
        unlock_warn(lock, &per_sandbox_lock_key, &per_sandbox_lock_code).await;
    }

    unlock_warn(lock, lock_key, &lock_code).await;
}

pub async fn ad_hoc_backup_check(infra: &Infra) {
    let lock = &infra.lock;
    let lock_key = "ad-hoc-backup-check";
    let Ok(Some(lock_code)) = lock.lock(lock_key, 300).await else {
        return;
    };

    let sandboxes =
        match repositories::sandbox::find_ad_hoc_backup_candidates(&infra.pool, 10).await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(error = %e, "failed to fetch ad-hoc backup candidates");
                unlock_warn(lock, lock_key, &lock_code).await;
                return;
            }
        };

    for sandbox in &sandboxes {
        let per_sandbox_lock_key = format!("sandbox-backup-{}", sandbox.id);
        let Ok(Some(per_sandbox_lock_code)) = lock.lock(&per_sandbox_lock_key, 60).await else {
            continue;
        };
        if let Err(e) = set_backup_pending(&infra.pool, sandbox).await {
            tracing::warn!(
                sandbox_id = %sandbox.id,
                error = %e,
                "failed to set ad-hoc backup pending"
            );
        }
        unlock_warn(lock, &per_sandbox_lock_key, &per_sandbox_lock_code).await;
    }

    unlock_warn(lock, lock_key, &lock_code).await;
}

pub(crate) async fn unlock_warn(lock: &RedisLock, key: &str, code: &str) {
    if let Err(e) = lock.unlock(key, code).await {
        tracing::warn!(key, error = %e, "failed to release lock");
    }
}
