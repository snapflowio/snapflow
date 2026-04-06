// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use futures_util::stream::{self, StreamExt};
use uuid::Uuid;

use crate::constants::sandbox::{MAX_CONCURRENT_SYNCS, MAX_SYNC_ITERATIONS, SYNC_LOOP_DELAY};
use crate::constants::{lock_keys, lock_ttls};
use crate::events::Event;
use crate::infra::Infra;
use crate::infra::lock::RedisLock;
use crate::models::Sandbox;
use crate::repositories;
use crate::schemas::sandbox::SandboxDto;
use crate::services::executor;
use crate::services::sandbox::{get_sandbox, state_matches_desired};
use snapflow_errors::Result;
use snapflow_models::{BackupState, ExecutorState, SandboxDesiredState, SandboxState};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncState {
    Again,
    Done,
}

#[derive(Debug, Default)]
pub struct StateUpdate<'a> {
    pub executor_id: Option<Option<Uuid>>,
    pub error_reason: Option<&'a str>,
    pub node_version: Option<&'a str>,
    pub backup_state: Option<BackupState>,
}

pub async fn update_sandbox_state(
    infra: &Infra,
    sandbox_id: Uuid,
    state: SandboxState,
    update: StateUpdate<'_>,
) -> Result<()> {
    update_sandbox_state_with_lock(infra, sandbox_id, state, update, None).await
}

pub async fn update_sandbox_state_with_lock(
    infra: &Infra,
    sandbox_id: Uuid,
    state: SandboxState,
    update: StateUpdate<'_>,
    expected_lock: Option<(&RedisLock, &str)>,
) -> Result<()> {
    if let Some((lock, expected_code)) = expected_lock {
        let lock_key = lock_keys::sandbox::sync_instance_state(&sandbox_id.to_string());
        match lock.get_code(&lock_key).await {
            Ok(Some(current_code)) if current_code != expected_code => {
                tracing::warn!(
                    sandbox_id = %sandbox_id,
                    "lock code mismatch, skipping state update"
                );
                return Ok(());
            }
            Ok(None) => {
                tracing::warn!(
                    sandbox_id = %sandbox_id,
                    "no lock code found, skipping state update"
                );
                return Ok(());
            }
            Err(e) => {
                tracing::warn!(
                    sandbox_id = %sandbox_id,
                    error = %e,
                    "failed to check lock code, proceeding with update"
                );
            }
            _ => {}
        }
    }

    let sandbox = get_sandbox(&infra.pool, sandbox_id).await?;

    if sandbox.state == state
        && update.executor_id.is_none()
        && update.error_reason.is_none()
        && update.node_version.is_none()
    {
        return Ok(());
    }

    let old_state = sandbox.state;

    let mut tx = infra.pool.begin().await?;

    repositories::sandbox::update_state(&mut *tx, sandbox_id, state).await?;

    if state_matches_desired(state, sandbox.desired_state)
        || matches!(state, SandboxState::Error | SandboxState::BuildFailed)
    {
        repositories::sandbox::update_pending(&mut *tx, sandbox_id, false).await?;
    }

    if state == SandboxState::Destroyed && update.backup_state.is_none() {
        repositories::sandbox::update_backup_state(&mut *tx, sandbox_id, BackupState::None).await?;
    }

    if let Some(Some(id)) = update.executor_id {
        repositories::sandbox::update_executor(&mut *tx, sandbox_id, id).await?;
    }

    if let Some(None) = update.executor_id {
        repositories::sandbox::update_executor_to_null(&mut *tx, sandbox_id).await?;
    }

    if let Some(reason) = update.error_reason {
        repositories::sandbox::update_error_reason(&mut *tx, sandbox_id, Some(reason)).await?;
    }

    if let Some(version) = update.node_version {
        repositories::sandbox::update_node_version(&mut *tx, sandbox_id, version).await?;
    }

    if let Some(backup_state) = update.backup_state {
        repositories::sandbox::update_backup_state(&mut *tx, sandbox_id, backup_state).await?;
        if backup_state == BackupState::None {
            repositories::sandbox::update_backup_snapshot(&mut *tx, sandbox_id, None, None).await?;
        }
    }

    tx.commit().await?;

    if old_state != state {
        let updated = get_sandbox(&infra.pool, sandbox_id).await?;

        let executor_domain = if let Some(eid) = updated.executor_id {
            repositories::executor::find_by_id(&infra.pool, eid)
                .await?
                .map(|e| e.domain)
        } else {
            None
        };

        let toolbox_url = infra.toolbox_base_url();
        let response = SandboxDto::from_sandbox(&updated, executor_domain, None, &toolbox_url);
        infra
            .realtime
            .sandbox_state_updated(updated.organization_id, &response, old_state, state);

        infra.events.emit(Event::SandboxStateUpdated {
            sandbox_id,
            organization_id: updated.organization_id,
            old_state,
            new_state: state,
        });

        match state {
            SandboxState::Destroyed => {
                infra.events.emit(Event::SandboxDestroyed {
                    sandbox_id,
                    organization_id: updated.organization_id,
                });
            }
            SandboxState::Archived => {
                infra.events.emit(Event::SandboxArchived {
                    sandbox_id,
                    organization_id: updated.organization_id,
                });
            }
            SandboxState::Started => {
                infra.events.emit(Event::SandboxStarted {
                    sandbox_id,
                    organization_id: updated.organization_id,
                });
            }
            SandboxState::Stopped => {
                infra.events.emit(Event::SandboxStopped {
                    sandbox_id,
                    organization_id: updated.organization_id,
                });
            }
            _ => {}
        }

        if let Err(e) =
            executor::handle_sandbox_state_update(&infra.pool, updated.executor_id, state).await
        {
            tracing::warn!(sandbox_id = %sandbox_id, error = %e, "failed to handle executor state update");
        }
    }

    Ok(())
}

pub async fn sync_instance_state(infra: &Infra, sandbox_id: Uuid) {
    let lock = &infra.lock;

    let mut iterations = 0u32;
    let sandbox_id_str = sandbox_id.to_string();
    let lock_key = lock_keys::sandbox::sync_instance_state(&sandbox_id_str);

    loop {
        iterations += 1;
        if iterations > MAX_SYNC_ITERATIONS {
            tracing::error!(
                sandbox_id = %sandbox_id,
                iterations,
                "sync loop exceeded max iterations, marking sandbox as error"
            );
            if let Err(e) = update_sandbox_state(
                infra,
                sandbox_id,
                SandboxState::Error,
                StateUpdate {
                    error_reason: Some("sync timed out: state did not converge"),
                    ..Default::default()
                },
            )
            .await
            {
                tracing::error!(sandbox_id = %sandbox_id, error = %e, "failed to set error state after max iterations");
            }
            return;
        }
        let Ok(Some(lock_code)) = lock
            .lock(&lock_key, lock_ttls::sandbox::SYNC_INSTANCE_STATE)
            .await
        else {
            return;
        };

        let sandbox = if let Ok(Some(s)) =
            repositories::sandbox::find_by_id(&infra.pool, sandbox_id).await
        {
            s
        } else {
            if let Err(e) = lock.unlock(&lock_key, &lock_code).await {
                tracing::warn!(sandbox_id = %sandbox_id, error = %e, "failed to release sync lock");
            }
            return;
        };

        if matches!(
            sandbox.state,
            SandboxState::Destroyed | SandboxState::Error | SandboxState::BuildFailed
        ) {
            if let Err(e) = lock.unlock(&lock_key, &lock_code).await {
                tracing::warn!(sandbox_id = %sandbox_id, error = %e, "failed to release sync lock");
            }
            return;
        }

        let sync_state = match run_action(infra, &sandbox, Some(lock)).await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(
                    sandbox_id = %sandbox_id,
                    error = %e,
                    "error processing desired state"
                );

                let error_msg = e.to_string();
                if let Err(update_err) = update_sandbox_state(
                    infra,
                    sandbox_id,
                    SandboxState::Error,
                    StateUpdate {
                        error_reason: Some(&error_msg),
                        ..Default::default()
                    },
                )
                .await
                {
                    tracing::error!(sandbox_id = %sandbox_id, error = %update_err, "failed to set error state");
                }

                SyncState::Done
            }
        };

        if let Err(e) = lock.unlock(&lock_key, &lock_code).await {
            tracing::warn!(sandbox_id = %sandbox_id, error = %e, "failed to release sync lock");
        }

        if sync_state != SyncState::Again {
            return;
        }

        tokio::time::sleep(SYNC_LOOP_DELAY).await;
    }
}

async fn run_action(
    infra: &Infra,
    sandbox: &Sandbox,
    lock: Option<&RedisLock>,
) -> Result<SyncState> {
    match sandbox.desired_state {
        SandboxDesiredState::Started => {
            super::sandbox_start_action::run(infra, sandbox, lock).await
        }
        SandboxDesiredState::Stopped => super::sandbox_stop_action::run(infra, sandbox).await,
        SandboxDesiredState::Destroyed => super::sandbox_destroy_action::run(infra, sandbox).await,
        SandboxDesiredState::Archived => {
            super::sandbox_archive_action::run(infra, sandbox, lock).await
        }
        SandboxDesiredState::Resized => super::sandbox_resize_action::run(infra, sandbox).await,
    }
}

pub async fn sync_states(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::sandbox::SYNC_STATES,
            lock_ttls::sandbox::SYNC_STATES,
        )
        .await
    else {
        return;
    };

    let sandboxes = match repositories::sandbox::find_out_of_sync(&infra.pool, 100).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch out-of-sync sandboxes");
            unlock_warn(lock, lock_keys::sandbox::SYNC_STATES, &lock_code).await;
            return;
        }
    };

    stream::iter(sandboxes.iter())
        .for_each_concurrent(MAX_CONCURRENT_SYNCS, |s| async {
            sync_instance_state(infra, s.id).await;
        })
        .await;

    unlock_warn(lock, lock_keys::sandbox::SYNC_STATES, &lock_code).await;
}

pub async fn auto_stop_check(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::sandbox::AUTO_STOP_CHECK,
            lock_ttls::sandbox::AUTO_STOP_CHECK,
        )
        .await
    else {
        return;
    };

    let all_executors = match repositories::executor::find_all_active(&infra.pool).await {
        Ok(e) => e,
        Err(_) => {
            unlock_warn(lock, lock_keys::sandbox::AUTO_STOP_CHECK, &lock_code).await;
            return;
        }
    };

    let ready_executor_ids: Vec<Uuid> = all_executors
        .iter()
        .filter(|e| e.state == ExecutorState::Ready)
        .map(|e| e.id)
        .collect();

    for executor_id in &ready_executor_ids {
        let candidates =
            match repositories::sandbox::find_auto_stop_candidates(&infra.pool, *executor_id, 10)
                .await
            {
                Ok(s) => s,
                Err(_) => continue,
            };

        for sandbox in &candidates {
            let instance_lock_key =
                lock_keys::sandbox::sync_instance_state(&sandbox.id.to_string());
            let Ok(Some(instance_lock_code)) = lock
                .lock(
                    &instance_lock_key,
                    lock_ttls::sandbox::SYNC_INSTANCE_STATE_SHORT,
                )
                .await
            else {
                continue;
            };

            let new_desired = if sandbox.auto_delete_interval == 0 {
                SandboxDesiredState::Destroyed
            } else {
                SandboxDesiredState::Stopped
            };

            if let Err(e) = repositories::sandbox::update_desired_state(
                &infra.pool,
                sandbox.id,
                new_desired,
                true,
            )
            .await
            {
                tracing::error!(sandbox_id = %sandbox.id, error = %e, "failed to update desired state for auto-stop");
            }

            unlock_warn(lock, &instance_lock_key, &instance_lock_code).await;

            sync_instance_state(infra, sandbox.id).await;
        }
    }

    unlock_warn(lock, lock_keys::sandbox::AUTO_STOP_CHECK, &lock_code).await;
}

pub async fn auto_archive_check(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::sandbox::AUTO_ARCHIVE_CHECK,
            lock_ttls::sandbox::AUTO_ARCHIVE_CHECK,
        )
        .await
    else {
        return;
    };

    let all_executors = match repositories::executor::find_all_active(&infra.pool).await {
        Ok(e) => e,
        Err(_) => {
            unlock_warn(lock, lock_keys::sandbox::AUTO_ARCHIVE_CHECK, &lock_code).await;
            return;
        }
    };

    let ready_executor_ids: Vec<Uuid> = all_executors
        .iter()
        .filter(|e| e.state == ExecutorState::Ready)
        .map(|e| e.id)
        .collect();

    for executor_id in &ready_executor_ids {
        let candidates = match repositories::sandbox::find_auto_archive_candidates(
            &infra.pool,
            *executor_id,
            100,
        )
        .await
        {
            Ok(s) => s,
            Err(_) => continue,
        };

        for sandbox in &candidates {
            let instance_lock_key =
                lock_keys::sandbox::sync_instance_state(&sandbox.id.to_string());
            let Ok(Some(instance_lock_code)) = lock
                .lock(
                    &instance_lock_key,
                    lock_ttls::sandbox::SYNC_INSTANCE_STATE_SHORT,
                )
                .await
            else {
                continue;
            };

            if let Err(e) = repositories::sandbox::update_desired_state(
                &infra.pool,
                sandbox.id,
                SandboxDesiredState::Archived,
                true,
            )
            .await
            {
                tracing::error!(sandbox_id = %sandbox.id, error = %e, "failed to update desired state for auto-archive");
            }

            unlock_warn(lock, &instance_lock_key, &instance_lock_code).await;

            sync_instance_state(infra, sandbox.id).await;
        }
    }

    unlock_warn(lock, lock_keys::sandbox::AUTO_ARCHIVE_CHECK, &lock_code).await;
}

pub async fn auto_delete_check(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(lock_code)) = lock
        .lock(
            lock_keys::sandbox::AUTO_DELETE_CHECK,
            lock_ttls::sandbox::AUTO_DELETE_CHECK,
        )
        .await
    else {
        return;
    };

    let all_executors = match repositories::executor::find_all_active(&infra.pool).await {
        Ok(e) => e,
        Err(_) => {
            unlock_warn(lock, lock_keys::sandbox::AUTO_DELETE_CHECK, &lock_code).await;
            return;
        }
    };

    let ready_executor_ids: Vec<Uuid> = all_executors
        .iter()
        .filter(|e| e.state == ExecutorState::Ready)
        .map(|e| e.id)
        .collect();

    for executor_id in &ready_executor_ids {
        let candidates = match repositories::sandbox::find_auto_delete_candidates(
            &infra.pool,
            *executor_id,
            100,
        )
        .await
        {
            Ok(s) => s,
            Err(_) => continue,
        };

        for sandbox in &candidates {
            let instance_lock_key =
                lock_keys::sandbox::sync_instance_state(&sandbox.id.to_string());
            let Ok(Some(instance_lock_code)) = lock
                .lock(
                    &instance_lock_key,
                    lock_ttls::sandbox::SYNC_INSTANCE_STATE_SHORT,
                )
                .await
            else {
                continue;
            };

            if let Err(e) = repositories::sandbox::update_desired_state(
                &infra.pool,
                sandbox.id,
                SandboxDesiredState::Destroyed,
                true,
            )
            .await
            {
                tracing::error!(sandbox_id = %sandbox.id, error = %e, "failed to update desired state for auto-delete");
            }

            unlock_warn(lock, &instance_lock_key, &instance_lock_code).await;

            sync_instance_state(infra, sandbox.id).await;
        }
    }

    unlock_warn(lock, lock_keys::sandbox::AUTO_DELETE_CHECK, &lock_code).await;
}

async fn unlock_warn(lock: &RedisLock, key: &str, code: &str) {
    if let Err(e) = lock.unlock(key, code).await {
        tracing::warn!(key, error = %e, "failed to release lock");
    }
}
