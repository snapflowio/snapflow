// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::time::Duration;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::constants::executor::MAX_CONCURRENT_IMAGE_BUILDS_PER_EXECUTOR;
use crate::constants::sandbox::{
    BUILDING_IMAGE_TIMEOUT_MINUTES, CREATING_TIMEOUT_MINUTES, MAX_BUILD_RETRIES,
    RECOVERY_COOLDOWN_SECS, RECOVERY_ERROR_SUBSTRINGS, RESTORING_TIMEOUT_MINUTES,
    STARTING_TIMEOUT_MINUTES,
};
use crate::executor;
use crate::infra::Infra;
use crate::infra::lock::RedisLock;
use crate::models::Sandbox;
use crate::repositories;
use crate::services;
use crate::services::executor::GetExecutorParams;
use snapflow_errors::{AppError, Result};
use snapflow_models::{BackupState, ExecutorState, ImageExecutorState, SandboxState};

use super::sandbox_actions::{StateUpdate, SyncState, update_sandbox_state};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackupImageEntry {
    pub image_name: String,
    pub created_at: String,
}

pub async fn run(infra: &Infra, sandbox: &Sandbox, lock: Option<&RedisLock>) -> Result<SyncState> {
    match sandbox.state {
        SandboxState::PendingBuild => handle_pending_build(infra, sandbox).await,
        SandboxState::BuildingImage => handle_building_image(infra, sandbox).await,
        SandboxState::Unknown => handle_unknown(infra, sandbox).await,
        SandboxState::Stopped => handle_stopped(infra, sandbox, lock).await,
        SandboxState::Creating => handle_creating(infra, sandbox).await,
        SandboxState::PullingImage | SandboxState::Starting => {
            handle_starting_check(infra, sandbox).await
        }
        SandboxState::Error => handle_error_on_start(infra, sandbox).await,
        SandboxState::Archived | SandboxState::Archiving => {
            handle_restore_from_archive(infra, sandbox, lock).await
        }
        SandboxState::Restoring => handle_restoring(infra, sandbox).await,
        _ => Ok(SyncState::Done),
    }
}

async fn handle_pending_build(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(ref build_info_ref) = sandbox.build_info_image_ref else {
        return Ok(SyncState::Done);
    };

    let executor_result = services::executor::get_random_available(
        &infra.pool,
        &GetExecutorParams {
            region: Some(&sandbox.region),
            sandbox_class: Some(sandbox.class),
            image_ref: Some(build_info_ref),
            excluded_executor_ids: &[],
        },
    )
    .await;

    if let Ok(exec) = executor_result {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Unknown,
            StateUpdate {
                executor_id: Some(Some(exec.id)),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Again);
    }

    let image_executors =
        services::executor::get_image_executors(&infra.pool, build_info_ref).await?;

    for ie in &image_executors {
        let Some(exec) = repositories::executor::find_by_id(&infra.pool, ie.executor_id).await?
        else {
            continue;
        };

        if exec.used < exec.capacity {
            if ie.state == ImageExecutorState::BuildingImage {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::BuildingImage,
                    StateUpdate {
                        executor_id: Some(Some(exec.id)),
                        ..Default::default()
                    },
                )
                .await?;
                return Ok(SyncState::Again);
            }
            if ie.state == ImageExecutorState::Error {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::BuildFailed,
                    StateUpdate {
                        error_reason: ie.error_reason.as_deref(),
                        ..Default::default()
                    },
                )
                .await?;
                return Ok(SyncState::Done);
            }
        }
    }

    let excluded = services::executor::get_executors_with_multiple_images_building(
        &infra.pool,
        MAX_CONCURRENT_IMAGE_BUILDS_PER_EXECUTOR,
    )
    .await?;

    let exec = services::executor::get_random_available(
        &infra.pool,
        &GetExecutorParams {
            region: Some(&sandbox.region),
            sandbox_class: Some(sandbox.class),
            image_ref: None,
            excluded_executor_ids: &excluded,
        },
    )
    .await?;

    build_on_executor(
        &infra.pool,
        build_info_ref,
        exec.id,
        sandbox.organization_id,
    )
    .await;

    update_sandbox_state(
        infra,
        sandbox.id,
        SandboxState::BuildingImage,
        StateUpdate {
            executor_id: Some(Some(exec.id)),
            ..Default::default()
        },
    )
    .await?;

    if let Err(e) = services::executor::recalculate_usage(&infra.pool, exec.id).await {
        tracing::warn!(executor_id = %exec.id, error = %e, "failed to recalculate executor usage");
    }

    Ok(SyncState::Again)
}

async fn handle_building_image(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        return Ok(SyncState::Done);
    };
    let Some(ref build_info_ref) = sandbox.build_info_image_ref else {
        return Ok(SyncState::Done);
    };

    let ie =
        services::executor::get_image_executor(&infra.pool, executor_id, build_info_ref).await?;

    if let Some(ie) = ie {
        match ie.state {
            ImageExecutorState::Ready => {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Unknown,
                    StateUpdate::default(),
                )
                .await?;
                return Ok(SyncState::Again);
            }
            ImageExecutorState::Error => {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::BuildFailed,
                    StateUpdate {
                        error_reason: ie.error_reason.as_deref(),
                        ..Default::default()
                    },
                )
                .await?;
                return Ok(SyncState::Done);
            }
            ImageExecutorState::BuildingImage => {
                if check_timeout(sandbox, BUILDING_IMAGE_TIMEOUT_MINUTES) {
                    update_sandbox_state(
                        infra,
                        sandbox.id,
                        SandboxState::Error,
                        StateUpdate {
                            error_reason: Some("timeout while building image on executor"),
                            ..Default::default()
                        },
                    )
                    .await?;
                    return Ok(SyncState::Done);
                }
                tokio::time::sleep(Duration::from_secs(1)).await;
                return Ok(SyncState::Again);
            }
            _ => {}
        }
    } else {
        tokio::time::sleep(Duration::from_secs(1)).await;
        return Ok(SyncState::Again);
    }

    Ok(SyncState::Done)
}

async fn handle_unknown(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let exec = match sandbox.executor_id {
        Some(id) => {
            let Some(e) = repositories::executor::find_by_id(&infra.pool, id).await? else {
                return Ok(SyncState::Again);
            };
            if e.state != ExecutorState::Ready {
                return Ok(SyncState::Again);
            }
            e
        }
        None => {
            let internal_name = if let Some(img_name) = sandbox.image.as_deref() {
                services::image::get_image_by_name(&infra.pool, img_name, sandbox.organization_id)
                    .await
                    .ok()
                    .and_then(|img| img.internal_name)
            } else {
                None
            };

            let found = services::executor::get_random_available(
                &infra.pool,
                &GetExecutorParams {
                    region: Some(&sandbox.region),
                    sandbox_class: Some(sandbox.class),
                    image_ref: internal_name.as_deref(),
                    excluded_executor_ids: &[],
                },
            )
            .await;

            let found = match found {
                Ok(e) => e,
                Err(_) => services::executor::get_random_available(
                    &infra.pool,
                    &GetExecutorParams {
                        region: Some(&sandbox.region),
                        sandbox_class: Some(sandbox.class),
                        image_ref: None,
                        excluded_executor_ids: &[],
                    },
                )
                .await
                .map_err(|_| AppError::BadRequest("no available executors".into()))?,
            };

            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Unknown,
                StateUpdate {
                    executor_id: Some(Some(found.id)),
                    ..Default::default()
                },
            )
            .await?;

            found
        }
    };

    let adapter = executor::create_adapter(&exec)?;

    let registry = if sandbox.build_info_image_ref.is_none() {
        let image_name = sandbox.image.as_deref().unwrap_or_default();
        let image =
            services::image::get_image_by_name(&infra.pool, image_name, sandbox.organization_id)
                .await?;

        let internal_name = image.internal_name.as_deref().unwrap_or(image_name);

        let reg = services::registry::find_by_image_name(
            &infra.pool,
            internal_name,
            Some(sandbox.organization_id),
        )
        .await?;

        if sandbox.image.as_deref() != Some(internal_name)
            && let Err(e) =
                repositories::sandbox::update_image(&infra.pool, sandbox.id, internal_name).await
        {
            tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to update sandbox image name");
        }

        reg
    } else {
        None
    };

    let entrypoint = match sandbox.build_info_image_ref.as_deref() {
        Some(bi_ref) => {
            let bi = repositories::build_info::find_by_ref(&infra.pool, bi_ref).await?;
            bi.and_then(|b| {
                b.dockerfile_content
                    .as_ref()
                    .map(|dc| parse_entrypoint_from_dockerfile(dc))
            })
        }
        None => None,
    };

    let fresh = repositories::sandbox::find_by_id(&infra.pool, sandbox.id)
        .await?
        .ok_or(AppError::NotFound("sandbox not found".into()))?;

    adapter
        .create_sandbox(&fresh, registry.as_ref(), entrypoint)
        .await?;

    update_sandbox_state(
        infra,
        sandbox.id,
        SandboxState::Creating,
        StateUpdate::default(),
    )
    .await?;

    Ok(SyncState::Again)
}

async fn handle_stopped(
    infra: &Infra,
    sandbox: &Sandbox,
    lock: Option<&RedisLock>,
) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        if sandbox.backup_state == BackupState::Completed {
            return handle_restore_from_archive(infra, sandbox, lock).await;
        }
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("sandbox has no executor assigned"),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    };

    let Some(exec) = repositories::executor::find_by_id(&infra.pool, executor_id).await? else {
        if sandbox.backup_state == BackupState::Completed {
            return handle_restore_from_archive(infra, sandbox, lock).await;
        }
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("executor not found"),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    };

    if (exec.unschedulable || exec.state != ExecutorState::Ready)
        && sandbox.backup_state == BackupState::Completed
    {
        repositories::sandbox::update_prev_executor(&infra.pool, sandbox.id, executor_id).await?;
        repositories::sandbox::update_executor_to_null(&infra.pool, sandbox.id).await?;

        let mut fresh = repositories::sandbox::find_by_id(&infra.pool, sandbox.id)
            .await?
            .ok_or(AppError::NotFound("sandbox not found".into()))?;
        fresh.prev_executor_id = Some(executor_id);
        fresh.executor_id = None;
        return handle_restore_from_archive(infra, &fresh, lock).await;
    }

    if exec.unschedulable || exec.state != ExecutorState::Ready {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("executor is not available or ready"),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    }

    let adapter = executor::create_adapter(&exec)?;

    match adapter.start_sandbox(&sandbox.id.to_string()).await {
        Ok(()) => {}
        Err(e) => {
            let err_msg = e.to_string().to_lowercase();
            let matches_recovery = RECOVERY_ERROR_SUBSTRINGS
                .iter()
                .any(|s| err_msg.contains(s));

            if matches_recovery && sandbox.backup_state == BackupState::Completed {
                if let Some(lock) = lock {
                    let cooldown_key = format!("sandbox-{}-restored-cooldown", sandbox.id);
                    let Ok(Some(_)) = lock.lock(&cooldown_key, RECOVERY_COOLDOWN_SECS).await else {
                        return Err(e);
                    };
                }

                tracing::warn!(
                    sandbox_id = %sandbox.id,
                    error = %err_msg,
                    "start failed with recoverable error, attempting restore to new executor"
                );

                repositories::sandbox::update_prev_executor(&infra.pool, sandbox.id, executor_id)
                    .await?;
                repositories::sandbox::update_executor_to_null(&infra.pool, sandbox.id).await?;

                let mut fresh = repositories::sandbox::find_by_id(&infra.pool, sandbox.id)
                    .await?
                    .ok_or(AppError::NotFound("sandbox not found".into()))?;
                fresh.prev_executor_id = Some(executor_id);
                fresh.executor_id = None;

                return handle_restore_from_archive(infra, &fresh, lock).await;
            }

            return Err(e);
        }
    }

    update_sandbox_state(
        infra,
        sandbox.id,
        SandboxState::Starting,
        StateUpdate::default(),
    )
    .await?;

    Ok(SyncState::Again)
}

async fn handle_creating(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        return Ok(SyncState::Again);
    };

    let Some(exec) = repositories::executor::find_by_id(&infra.pool, executor_id).await? else {
        return Ok(SyncState::Again);
    };

    if check_timeout(sandbox, CREATING_TIMEOUT_MINUTES) {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("timeout while creating sandbox"),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    }

    let adapter = executor::create_adapter(&exec)?;
    let info = adapter.sandbox_info(&sandbox.id.to_string()).await?;

    match info.state {
        SandboxState::PullingImage => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::PullingImage,
                StateUpdate::default(),
            )
            .await?;
        }
        SandboxState::Error | SandboxState::Destroyed => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Error,
                StateUpdate {
                    error_reason: Some("sandbox failed during creation"),
                    ..Default::default()
                },
            )
            .await?;
            return Ok(SyncState::Done);
        }
        _ => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Starting,
                StateUpdate::default(),
            )
            .await?;
        }
    }

    Ok(SyncState::Again)
}

async fn handle_starting_check(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        return Ok(SyncState::Again);
    };

    let Some(exec) = repositories::executor::find_by_id(&infra.pool, executor_id).await? else {
        return Ok(SyncState::Again);
    };

    let adapter = executor::create_adapter(&exec)?;
    let info = adapter.sandbox_info(&sandbox.id.to_string()).await?;

    match info.state {
        SandboxState::Started => {
            let node_version = match adapter
                .get_sandbox_node_version(&sandbox.id.to_string())
                .await
            {
                Ok(v) => Some(v),
                Err(e) => {
                    tracing::error!(
                        sandbox_id = %sandbox.id,
                        error = %e,
                        "failed to get sandbox node version"
                    );
                    None
                }
            };

            let backup_reset = matches!(
                sandbox.backup_state,
                BackupState::Failed | BackupState::Completed
            );
            if backup_reset
                && let Err(e) = repositories::sandbox::update_backup_state(
                    &infra.pool,
                    sandbox.id,
                    BackupState::None,
                )
                .await
            {
                tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to reset backup state");
            }

            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Started,
                StateUpdate {
                    node_version: node_version.as_deref(),
                    ..Default::default()
                },
            )
            .await?;

            if let Some(prev_executor_id) = sandbox.prev_executor_id {
                cleanup_previous_executor(&infra.pool, sandbox.id, prev_executor_id).await;
            }
        }
        SandboxState::Starting => {
            if check_timeout(sandbox, STARTING_TIMEOUT_MINUTES) {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Error,
                    StateUpdate {
                        error_reason: Some("timeout while starting sandbox"),
                        ..Default::default()
                    },
                )
                .await?;
                return Ok(SyncState::Done);
            }
        }
        SandboxState::Restoring => {
            if check_timeout(sandbox, RESTORING_TIMEOUT_MINUTES) {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Error,
                    StateUpdate {
                        error_reason: Some("timeout while restoring sandbox"),
                        ..Default::default()
                    },
                )
                .await?;
                return Ok(SyncState::Done);
            }
        }
        SandboxState::Creating => {
            if check_timeout(sandbox, CREATING_TIMEOUT_MINUTES) {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Error,
                    StateUpdate {
                        error_reason: Some("timeout while creating sandbox"),
                        ..Default::default()
                    },
                )
                .await?;
                return Ok(SyncState::Done);
            }
        }
        SandboxState::Error | SandboxState::Destroyed => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Error,
                StateUpdate {
                    error_reason: Some("sandbox failed to start"),
                    ..Default::default()
                },
            )
            .await?;
            return Ok(SyncState::Done);
        }
        _ => {}
    }

    Ok(SyncState::Again)
}

async fn handle_error_on_start(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        return Ok(SyncState::Done);
    };

    let Some(exec) = repositories::executor::find_by_id(&infra.pool, executor_id).await? else {
        return Ok(SyncState::Done);
    };

    let adapter = executor::create_adapter(&exec)?;
    let info = adapter.sandbox_info(&sandbox.id.to_string()).await?;

    if info.state == SandboxState::Started {
        let node_version = match adapter
            .get_sandbox_node_version(&sandbox.id.to_string())
            .await
        {
            Ok(v) => Some(v),
            Err(e) => {
                tracing::error!(
                    sandbox_id = %sandbox.id,
                    error = %e,
                    "failed to get sandbox node version"
                );
                None
            }
        };

        if let Err(e) =
            repositories::sandbox::update_backup_state(&infra.pool, sandbox.id, BackupState::None)
                .await
        {
            tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to reset backup state");
        }

        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Started,
            StateUpdate {
                node_version: node_version.as_deref(),
                ..Default::default()
            },
        )
        .await?;
    }

    Ok(SyncState::Done)
}

async fn cleanup_previous_executor(pool: &sqlx::PgPool, sandbox_id: Uuid, prev_executor_id: Uuid) {
    let Some(exec) = repositories::executor::find_by_id(pool, prev_executor_id)
        .await
        .ok()
        .flatten()
    else {
        tracing::warn!(
            prev_executor_id = %prev_executor_id,
            sandbox_id = %sandbox_id,
            "previously assigned executor not found"
        );
        if let Err(e) = repositories::sandbox::clear_prev_executor(pool, sandbox_id).await {
            tracing::warn!(sandbox_id = %sandbox_id, error = %e, "failed to clear prev executor");
        }
        return;
    };

    let Ok(adapter) = executor::create_adapter(&exec) else {
        return;
    };

    let sandbox_id_str = sandbox_id.to_string();

    if let Err(e) = async {
        adapter.destroy_sandbox(&sandbox_id_str).await?;

        for retry in 0..10u32 {
            match adapter.sandbox_info(&sandbox_id_str).await {
                Ok(info) if info.state == SandboxState::Destroyed => break,
                Err(e) if e.to_string().contains("404") => break,
                _ => {}
            }
            tokio::time::sleep(Duration::from_secs(u64::from(retry))).await;
        }

        adapter.remove_destroyed_sandbox(&sandbox_id_str).await?;
        Ok::<(), AppError>(())
    }
    .await
    {
        tracing::error!(
            sandbox_id = %sandbox_id,
            executor_id = %exec.id,
            error = %e,
            "failed to cleanup sandbox on previous executor"
        );
    }

    if let Err(e) = repositories::sandbox::clear_prev_executor(pool, sandbox_id).await {
        tracing::warn!(sandbox_id = %sandbox_id, error = %e, "failed to clear prev executor after cleanup");
    }
}

async fn build_on_executor(
    pool: &sqlx::PgPool,
    build_info_ref: &str,
    executor_id: Uuid,
    organization_id: Uuid,
) {
    let Some(exec) = repositories::executor::find_by_id(pool, executor_id)
        .await
        .ok()
        .flatten()
    else {
        return;
    };

    let Ok(adapter) = executor::create_adapter(&exec) else {
        return;
    };

    let Some(build_info) = repositories::build_info::find_by_ref(pool, build_info_ref)
        .await
        .ok()
        .flatten()
    else {
        return;
    };

    let org_id_str = organization_id.to_string();

    let mut retries = 0u32;
    loop {
        match adapter
            .build_image(&build_info, Some(&org_id_str), None, None)
            .await
        {
            Ok(()) => break,
            Err(e) => {
                let msg = e.to_string();
                if !msg.contains("ECONNRESET") && !msg.contains("connection reset") {
                    if let Err(e) = services::executor::create_image_executor(
                        pool,
                        executor_id,
                        build_info_ref,
                        ImageExecutorState::Error,
                        Some(&msg),
                    )
                    .await
                    {
                        tracing::error!(executor_id = %executor_id, error = %e, "failed to record image executor error state");
                    }
                    return;
                }
            }
        }
        retries += 1;
        if retries >= MAX_BUILD_RETRIES {
            if let Err(e) = services::executor::create_image_executor(
                pool,
                executor_id,
                build_info_ref,
                ImageExecutorState::Error,
                Some("timeout while building"),
            )
            .await
            {
                tracing::error!(executor_id = %executor_id, error = %e, "failed to record image executor timeout");
            }
            return;
        }
        tokio::time::sleep(Duration::from_secs(u64::from(retries))).await;
    }

    let exists = adapter.image_exists(build_info_ref).await.unwrap_or(false);
    let state = if exists {
        ImageExecutorState::Ready
    } else {
        ImageExecutorState::BuildingImage
    };

    if let Err(e) =
        services::executor::create_image_executor(pool, executor_id, build_info_ref, state, None)
            .await
    {
        tracing::error!(executor_id = %executor_id, error = %e, "failed to record image executor state");
    }
}

async fn handle_restore_from_archive(
    infra: &Infra,
    sandbox: &Sandbox,
    lock: Option<&RedisLock>,
) -> Result<SyncState> {
    if sandbox.backup_state != BackupState::Completed {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("cannot restore: no completed backup"),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    }

    let backup_registry_id = match sandbox.backup_registry_id {
        Some(id) => id,
        None => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Error,
                StateUpdate {
                    error_reason: Some("no backup registry configured"),
                    ..Default::default()
                },
            )
            .await?;
            return Ok(SyncState::Done);
        }
    };

    let registry = repositories::registry::find_by_id(&infra.pool, backup_registry_id).await?;

    let valid_backup = find_valid_backup_image(sandbox, registry.as_ref(), &infra.pool, lock).await;

    let Some(backup_snapshot) = valid_backup else {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("no valid backup snapshot found for restore"),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    };

    let prev_executor_id = sandbox.prev_executor_id;
    let excluded: Vec<Uuid> = prev_executor_id.into_iter().collect();

    let base_image_ref = if let Some(img_name) = sandbox.image.as_deref() {
        services::image::get_image_by_name(&infra.pool, img_name, sandbox.organization_id)
            .await
            .ok()
            .and_then(|img| img.internal_name)
    } else {
        None
    };

    let exec_result = if base_image_ref.is_some() {
        let result = services::executor::get_random_available(
            &infra.pool,
            &GetExecutorParams {
                region: Some(&sandbox.region),
                sandbox_class: Some(sandbox.class),
                image_ref: base_image_ref.as_deref(),
                excluded_executor_ids: &excluded,
            },
        )
        .await;

        match result {
            Ok(exec) => Ok(exec),
            Err(_) => {
                services::executor::get_random_available(
                    &infra.pool,
                    &GetExecutorParams {
                        region: Some(&sandbox.region),
                        sandbox_class: Some(sandbox.class),
                        image_ref: None,
                        excluded_executor_ids: &excluded,
                    },
                )
                .await
            }
        }
    } else {
        services::executor::get_random_available(
            &infra.pool,
            &GetExecutorParams {
                region: Some(&sandbox.region),
                sandbox_class: Some(sandbox.class),
                image_ref: None,
                excluded_executor_ids: &excluded,
            },
        )
        .await
    };

    let exec = exec_result
        .map_err(|_| AppError::BadRequest("no available executors for restore".into()))?;

    if let Err(e) =
        repositories::sandbox::update_image(&infra.pool, sandbox.id, &backup_snapshot).await
    {
        tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to update image for restore");
    }

    update_sandbox_state(
        infra,
        sandbox.id,
        SandboxState::Restoring,
        StateUpdate {
            executor_id: Some(Some(exec.id)),
            ..Default::default()
        },
    )
    .await?;

    let fresh = repositories::sandbox::find_by_id(&infra.pool, sandbox.id)
        .await?
        .ok_or(AppError::NotFound("sandbox not found".into()))?;

    let adapter = executor::create_adapter(&exec)?;
    adapter
        .create_sandbox(&fresh, registry.as_ref(), None)
        .await?;

    update_sandbox_state(
        infra,
        sandbox.id,
        SandboxState::Creating,
        StateUpdate::default(),
    )
    .await?;

    Ok(SyncState::Again)
}

async fn find_valid_backup_image(
    sandbox: &Sandbox,
    registry: Option<&crate::models::Registry>,
    pool: &sqlx::PgPool,
    _lock: Option<&RedisLock>,
) -> Option<String> {
    sandbox.backup_registry_id?;

    let registry = registry?;

    let mut existing: Vec<BackupImageEntry> =
        serde_json::from_value(sandbox.existing_backup_snapshots.clone()).unwrap_or_default();
    existing.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    let mut candidates: Vec<String> = Vec::default();

    if let Some(ref image_name) = sandbox.backup_snapshot
        && !image_name.is_empty()
    {
        candidates.push(image_name.clone());
    }

    for entry in &existing {
        if !candidates.iter().any(|c| c == &entry.image_name) {
            candidates.push(entry.image_name.clone());
        }
    }

    for candidate in &candidates {
        if services::registry::check_image_exists_in_registry(candidate, registry).await {
            return Some(candidate.clone());
        }

        tracing::debug!(
            sandbox_id = %sandbox.id,
            backup_image = %candidate,
            "backup image not found in registry, trying next"
        );

        existing.retain(|entry| entry.image_name != *candidate);
        let updated_value = match serde_json::to_value(&existing) {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(sandbox_id = %sandbox.id, error = %e, "failed to serialize backup snapshots");
                continue;
            }
        };
        if let Err(e) = repositories::sandbox::update_existing_backup_snapshots(
            pool,
            sandbox.id,
            &updated_value,
        )
        .await
        {
            tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to update backup snapshots");
        }
    }

    None
}

async fn handle_restoring(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    if check_timeout(sandbox, RESTORING_TIMEOUT_MINUTES) {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("timeout while restoring sandbox"),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    }
    handle_creating(infra, sandbox).await
}

fn check_timeout(sandbox: &Sandbox, timeout_minutes: i64) -> bool {
    (chrono::Utc::now() - sandbox.updated_at).num_minutes() > timeout_minutes
}

fn parse_entrypoint_from_dockerfile(content: &str) -> Vec<String> {
    if let Some(caps) = content.lines().find(|l| l.trim().starts_with("ENTRYPOINT")) {
        let raw = caps.trim().strip_prefix("ENTRYPOINT").unwrap_or("").trim();
        if let Ok(parsed) = serde_json::from_str::<Vec<String>>(raw) {
            return parsed;
        }
        return vec![raw.replace(['\"', '\''], "")];
    }

    if let Some(caps) = content.lines().find(|l| l.trim().starts_with("CMD")) {
        let raw = caps.trim().strip_prefix("CMD").unwrap_or("").trim();
        if let Ok(parsed) = serde_json::from_str::<Vec<String>>(raw) {
            return parsed;
        }
        return vec![raw.replace(['\"', '\''], "")];
    }

    vec!["sleep".into(), "infinity".into()]
}
