// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::sandbox_actions::{StateUpdate, SyncState, update_sandbox_state};
use crate::constants::sandbox::{MAX_ARCHIVE_BACKUP_RETRIES, STOP_TIMEOUT_MINUTES};
use crate::executor;
use crate::infra::Infra;
use crate::infra::lock::RedisLock;
use crate::models::Sandbox;
use crate::repositories;
use snapflow_errors::Result;
use snapflow_models::{BackupState, ExecutorState, SandboxState};

pub async fn run(infra: &Infra, sandbox: &Sandbox, lock: Option<&RedisLock>) -> Result<SyncState> {
    match sandbox.state {
        SandboxState::Stopped | SandboxState::Archiving => {
            handle_archive(infra, sandbox, lock).await
        }
        SandboxState::Started => handle_stop_before_archive(infra, sandbox).await,
        SandboxState::Stopping => handle_wait_for_stop(infra, sandbox).await,
        _ => Ok(SyncState::Done),
    }
}

async fn handle_stop_before_archive(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        finalize_archive(infra, sandbox).await?;
        return Ok(SyncState::Done);
    };

    let Some(exec) = repositories::executor::find_by_id(&infra.pool, executor_id).await? else {
        finalize_archive(infra, sandbox).await?;
        return Ok(SyncState::Done);
    };

    if exec.state != ExecutorState::Ready {
        return Ok(SyncState::Again);
    }

    let adapter = executor::create_adapter(&exec)?;
    adapter.stop_sandbox(&sandbox.id.to_string()).await?;

    update_sandbox_state(
        infra,
        sandbox.id,
        SandboxState::Stopping,
        StateUpdate::default(),
    )
    .await?;

    Ok(SyncState::Again)
}

async fn handle_wait_for_stop(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let elapsed = (chrono::Utc::now() - sandbox.updated_at).num_minutes();
    if elapsed > STOP_TIMEOUT_MINUTES {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("sandbox stop timed out during archive"),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    }

    let Some(executor_id) = sandbox.executor_id else {
        return Ok(SyncState::Again);
    };

    let Some(exec) = repositories::executor::find_by_id(&infra.pool, executor_id).await? else {
        return Ok(SyncState::Again);
    };

    if exec.state != ExecutorState::Ready {
        return Ok(SyncState::Again);
    }

    let adapter = executor::create_adapter(&exec)?;
    let info = adapter.sandbox_info(&sandbox.id.to_string()).await?;

    match info.state {
        SandboxState::Stopped => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Stopped,
                StateUpdate::default(),
            )
            .await?;
            Ok(SyncState::Again)
        }
        SandboxState::Error => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Error,
                StateUpdate {
                    error_reason: Some("sandbox entered error state while stopping for archive"),
                    ..Default::default()
                },
            )
            .await?;
            Ok(SyncState::Done)
        }
        _ => Ok(SyncState::Again),
    }
}

async fn handle_archive(
    infra: &Infra,
    sandbox: &Sandbox,
    lock: Option<&RedisLock>,
) -> Result<SyncState> {
    let archive_lock_code = if let Some(lock) = lock {
        if let Some(executor_id) = sandbox.executor_id {
            let archive_lock_key = format!("archive-lock-{executor_id}");
            let Ok(Some(code)) = lock.lock(&archive_lock_key, 60).await else {
                return Ok(SyncState::Done);
            };
            Some((archive_lock_key, code))
        } else {
            None
        }
    } else {
        None
    };

    let result = handle_archive_inner(infra, sandbox, lock).await;

    if let Some((ref key, ref code)) = archive_lock_code
        && let Some(lock) = lock
        && let Err(e) = lock.unlock(key, code).await
    {
        tracing::warn!(error = %e, key, "failed to release archive lock");
    }

    result
}

async fn handle_archive_inner(
    infra: &Infra,
    sandbox: &Sandbox,
    lock: Option<&RedisLock>,
) -> Result<SyncState> {
    match sandbox.backup_state {
        BackupState::Failed => {
            let retry_count = get_archive_retry_count(sandbox, lock).await;

            if retry_count > MAX_ARCHIVE_BACKUP_RETRIES {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Error,
                    StateUpdate {
                        error_reason: Some("backup failed during archive after max retries"),
                        ..Default::default()
                    },
                )
                .await?;

                if let Some(lock) = lock {
                    let key = format!("archive-error-retry-{}", sandbox.id);
                    if let Err(e) = lock.force_unlock(&key).await {
                        tracing::warn!(error = %e, key, "failed to clear archive error retry key");
                    }
                }

                return Ok(SyncState::Done);
            }

            increment_archive_retry_count(sandbox, lock).await;

            if let Err(e) = repositories::sandbox::update_backup_state(
                &infra.pool,
                sandbox.id,
                BackupState::Pending,
            )
            .await
            {
                tracing::error!(
                    sandbox_id = %sandbox.id,
                    error = %e,
                    "failed to reset backup state to pending for retry"
                );
            }

            Ok(SyncState::Done)
        }
        BackupState::Completed => handle_destroy_after_backup(infra, sandbox).await,
        _ => {
            if sandbox.state == SandboxState::Stopped {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Archiving,
                    StateUpdate::default(),
                )
                .await?;

                if sandbox.backup_state == BackupState::None
                    && let Err(e) = repositories::sandbox::update_backup_state(
                        &infra.pool,
                        sandbox.id,
                        BackupState::Pending,
                    )
                    .await
                {
                    tracing::warn!(
                        sandbox_id = %sandbox.id,
                        error = %e,
                        "failed to set backup state to pending"
                    );
                }
            }
            Ok(SyncState::Done)
        }
    }
}

async fn handle_destroy_after_backup(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        finalize_archive(infra, sandbox).await?;
        return Ok(SyncState::Done);
    };

    let Some(exec) = repositories::executor::find_by_id(&infra.pool, executor_id).await? else {
        finalize_archive(infra, sandbox).await?;
        return Ok(SyncState::Done);
    };

    if exec.state != ExecutorState::Ready {
        return Ok(SyncState::Again);
    }

    let adapter = executor::create_adapter(&exec)?;
    let sandbox_id_str = sandbox.id.to_string();

    match adapter.sandbox_info(&sandbox_id_str).await {
        Ok(info) => match info.state {
            SandboxState::Destroyed => {
                finalize_archive(infra, sandbox).await?;
                Ok(SyncState::Done)
            }
            SandboxState::Destroying => Ok(SyncState::Again),
            _ => {
                if let Err(e) = adapter.destroy_sandbox(&sandbox_id_str).await {
                    tracing::warn!(
                        sandbox_id = %sandbox.id,
                        error = %e,
                        "failed to destroy sandbox on executor during archive"
                    );
                }
                Ok(SyncState::Again)
            }
        },
        Err(e) => {
            let err_str = e.to_string();
            if err_str.contains("404")
                || err_str.contains("not found")
                || err_str.contains("already destroyed")
            {
                finalize_archive(infra, sandbox).await?;
                Ok(SyncState::Done)
            } else {
                tracing::warn!(
                    sandbox_id = %sandbox.id,
                    error = %e,
                    "failed to get sandbox info during archive"
                );
                Ok(SyncState::Done)
            }
        }
    }
}

async fn finalize_archive(infra: &Infra, sandbox: &Sandbox) -> Result<()> {
    if let Err(e) = repositories::sandbox::clear_executor_for_archive(&infra.pool, sandbox.id).await
    {
        tracing::warn!(
            sandbox_id = %sandbox.id,
            error = %e,
            "failed to clear executor during archive finalization"
        );
    }

    update_sandbox_state(
        infra,
        sandbox.id,
        SandboxState::Archived,
        StateUpdate {
            executor_id: Some(None),
            ..Default::default()
        },
    )
    .await?;

    Ok(())
}

async fn get_archive_retry_count(sandbox: &Sandbox, lock: Option<&RedisLock>) -> i64 {
    let Some(lock) = lock else {
        return 0;
    };
    let key = format!("archive-error-retry-{}", sandbox.id);
    lock.get_counter(&key).await.unwrap_or(0)
}

async fn increment_archive_retry_count(sandbox: &Sandbox, lock: Option<&RedisLock>) {
    let Some(lock) = lock else {
        return;
    };
    let key = format!("archive-error-retry-{}", sandbox.id);
    if let Err(e) = lock.increment_counter(&key, 720).await {
        tracing::warn!(
            sandbox_id = %sandbox.id,
            error = %e,
            "failed to increment archive retry counter"
        );
    }
}
