// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::time::Duration;

use chrono::Utc;
use rand::seq::SliceRandom;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::constants::executor::MAX_CONCURRENT_IMAGE_BUILDS_PER_EXECUTOR;
use crate::constants::sandbox::{
    DEFAULT_IMAGE_CPU, DEFAULT_IMAGE_DISK, DEFAULT_IMAGE_MEMORY, DEFAULT_SANDBOX_GPU,
};
use crate::constants::{lock_keys, lock_ttls};
use crate::executor;
use crate::infra::Infra;
use crate::infra::docker::DockerClient;
use crate::models::{Executor, Image, ImageExecutor, Organization, Registry};
use crate::realtime::Realtime;
use crate::repositories;
use crate::schemas::sandbox::{CreateImageDto, ImageDto, PaginatedImagesDto};
use crate::services::{executor as executor_service, registry as registry_service};
use snapflow_errors::{AppError, Result};
use snapflow_models::{ExecutorState, ImageExecutorState, ImageState, RegistryType};

pub fn generate_build_info_hash(dockerfile_content: &str, context_hashes: &[String]) -> String {
    let mut sorted = context_hashes.to_vec();
    sorted.sort();
    let combined = format!("{}{}", dockerfile_content, sorted.join(""));
    let hash = hex::encode(Sha256::digest(combined.as_bytes()));
    format!("snapflow-{hash}:snapflow")
}

pub async fn create_image(
    pool: &PgPool,
    organization: &Organization,
    req: &CreateImageDto,
    general: bool,
    realtime: &Realtime,
) -> Result<Image> {
    if organization.suspended {
        return Err(AppError::Forbidden("organization is suspended".into()));
    }

    let owned_count =
        repositories::image::count_owned_by_organization(pool, organization.id).await?;
    if owned_count >= organization.image_quota as i64 {
        return Err(AppError::Forbidden(
            "reached the maximum number of images in the organization".into(),
        ));
    }

    if let Some(cpu) = req.cpu
        && cpu > organization.max_cpu_per_sandbox
    {
        return Err(AppError::Forbidden(format!(
            "CPU request {cpu} exceeds maximum allowed per sandbox ({})",
            organization.max_cpu_per_sandbox
        )));
    }
    if let Some(memory) = req.memory
        && memory > organization.max_memory_per_sandbox
    {
        return Err(AppError::Forbidden(format!(
            "memory request {memory}GB exceeds maximum allowed per sandbox ({}GB)",
            organization.max_memory_per_sandbox
        )));
    }
    if let Some(disk) = req.disk
        && disk > organization.max_disk_per_sandbox
    {
        return Err(AppError::Forbidden(format!(
            "disk request {disk}GB exceeds maximum allowed per sandbox ({}GB)",
            organization.max_disk_per_sandbox
        )));
    }

    let build_info_image_ref = match &req.build_info {
        Some(bi) => {
            let image_ref = generate_build_info_hash(
                &bi.dockerfile_content,
                bi.context_hashes.as_deref().unwrap_or_default(),
            );
            let existing = repositories::build_info::find_by_ref(pool, &image_ref).await?;
            if existing.is_none() {
                repositories::build_info::upsert(
                    pool,
                    &image_ref,
                    Some(&bi.dockerfile_content),
                    bi.context_hashes.as_deref(),
                )
                .await?;
            }
            Some(image_ref)
        }
        None => None,
    };

    let state = if build_info_image_ref.is_some() {
        ImageState::BuildPending
    } else {
        ImageState::Pending
    };

    let image = repositories::image::create(
        pool,
        &repositories::image::CreateImageParams {
            organization_id: Some(organization.id),
            name: &req.name,
            image_name: req.image_name.as_deref().unwrap_or(&req.name),
            general,
            state,
            cpu: req.cpu.unwrap_or(DEFAULT_IMAGE_CPU),
            gpu: req.gpu.unwrap_or(DEFAULT_SANDBOX_GPU),
            mem: req.memory.unwrap_or(DEFAULT_IMAGE_MEMORY),
            disk: req.disk.unwrap_or(DEFAULT_IMAGE_DISK),
            entrypoint: req.entrypoint.as_deref(),
            cmd: req.cmd.as_deref(),
            build_info_image_ref: build_info_image_ref.as_deref(),
        },
    )
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e
            && db_err.code().as_deref() == Some("23505")
        {
            return AppError::Conflict(format!(
                "image with name \"{}\" already exists for this organization",
                req.name
            ));
        }
        AppError::from(e)
    })?;

    if let Some(org_id) = image.organization_id {
        let build_info = match &image.build_info_image_ref {
            Some(r) => repositories::build_info::find_by_ref(pool, r).await?,
            None => None,
        };
        realtime.image_created(org_id, &ImageDto::from_image(&image, build_info.as_ref()));
    }

    Ok(image)
}

pub async fn remove_image(pool: &PgPool, image_id: Uuid, realtime: &Realtime) -> Result<()> {
    let image = repositories::image::find_by_id(pool, image_id)
        .await?
        .ok_or(AppError::NotFound(format!("image {image_id} not found")))?;

    if image.general {
        return Err(AppError::Forbidden(
            "you cannot delete a general image".into(),
        ));
    }

    let old_state = image.state;

    repositories::image::update_state(pool, image_id, ImageState::Removing).await?;

    if let Some(org_id) = image.organization_id {
        let updated = Image {
            state: ImageState::Removing,
            ..image.clone()
        };
        let build_info = match &updated.build_info_image_ref {
            Some(r) => repositories::build_info::find_by_ref(pool, r).await?,
            None => None,
        };
        realtime.image_state_updated(
            org_id,
            &ImageDto::from_image(&updated, build_info.as_ref()),
            old_state,
            ImageState::Removing,
        );
    }

    Ok(())
}

pub async fn get_all_images(
    pool: &PgPool,
    organization_id: Uuid,
    page: i64,
    limit: i64,
) -> Result<PaginatedImagesDto> {
    let images = repositories::image::find_by_organization_paginated(
        pool,
        organization_id,
        limit,
        (page - 1) * limit,
    )
    .await?;

    let total = repositories::image::count_by_organization(pool, organization_id).await?;

    let mut items = Vec::with_capacity(images.len());
    for img in &images {
        let bi = match &img.build_info_image_ref {
            Some(r) => repositories::build_info::find_by_ref(pool, r).await?,
            None => None,
        };
        items.push(ImageDto::from_image(img, bi.as_ref()));
    }

    Ok(PaginatedImagesDto {
        items,
        total,
        page,
        total_pages: (total + limit - 1) / limit,
    })
}

pub async fn get_image(pool: &PgPool, image_id: Uuid) -> Result<Image> {
    repositories::image::find_by_id(pool, image_id)
        .await?
        .ok_or(AppError::NotFound(format!("image {image_id} not found")))
}

pub async fn get_image_by_name(pool: &PgPool, name: &str, organization_id: Uuid) -> Result<Image> {
    if let Some(image) = repositories::image::find_by_name(pool, name, organization_id).await? {
        return Ok(image);
    }

    repositories::image::find_general_by_name(pool, name)
        .await?
        .ok_or(AppError::NotFound(format!(
            "image with name {name} not found"
        )))
}

pub async fn set_image_general_status(
    pool: &PgPool,
    image_id: Uuid,
    general: bool,
) -> Result<Image> {
    let image = get_image(pool, image_id).await?;
    repositories::image::update_general(pool, image_id, general).await?;
    Ok(Image { general, ..image })
}

pub async fn activate_image(pool: &PgPool, image_id: Uuid, realtime: &Realtime) -> Result<Image> {
    let image = get_image(pool, image_id).await?;

    if image.state == ImageState::Active {
        return Err(AppError::BadRequest(format!(
            "image {image_id} is already active"
        )));
    }
    if image.state != ImageState::Inactive {
        return Err(AppError::BadRequest(format!(
            "image {image_id} cannot be activated - it is in {:?} state",
            image.state
        )));
    }

    let old_state = image.state;
    repositories::image::activate(pool, image_id, ImageState::Active).await?;

    let updated = Image {
        state: ImageState::Active,
        ..image
    };

    if let Some(org_id) = updated.organization_id {
        let build_info = match &updated.build_info_image_ref {
            Some(r) => repositories::build_info::find_by_ref(pool, r).await?,
            None => None,
        };
        realtime.image_state_updated(
            org_id,
            &ImageDto::from_image(&updated, build_info.as_ref()),
            old_state,
            ImageState::Active,
        );
    }

    Ok(updated)
}

pub async fn deactivate_image(pool: &PgPool, image_id: Uuid, realtime: &Realtime) -> Result<()> {
    let image = repositories::image::find_by_id(pool, image_id)
        .await?
        .ok_or(AppError::NotFound(format!("image {image_id} not found")))?;

    if image.state == ImageState::Inactive {
        return Ok(());
    }

    let old_state = image.state;
    repositories::image::update_state(pool, image_id, ImageState::Inactive).await?;

    if let Some(org_id) = image.organization_id {
        let updated = Image {
            state: ImageState::Inactive,
            ..image.clone()
        };
        let build_info = match &updated.build_info_image_ref {
            Some(r) => repositories::build_info::find_by_ref(pool, r).await?,
            None => None,
        };
        realtime.image_state_updated(
            org_id,
            &ImageDto::from_image(&updated, build_info.as_ref()),
            old_state,
            ImageState::Inactive,
        );
    }

    if let Some(ref internal_name) = image.internal_name {
        let result = repositories::executor::update_image_executor_state(
            pool,
            internal_name,
            ImageExecutorState::Removing,
        )
        .await;

        match result {
            Ok(count) => {
                tracing::debug!(
                    image_id = %image_id,
                    count,
                    "deactivated image and marked image executors for removal"
                );
            }
            Err(e) => {
                tracing::error!(
                    image_id = %image_id,
                    error = %e,
                    "deactivated image but failed to mark image executors for removal"
                );
            }
        }
    }

    Ok(())
}

pub async fn can_cleanup_image(pool: &PgPool, image_name: &str) -> Result<bool> {
    let image = repositories::image::find_by_internal_name_active(pool, image_name).await?;
    Ok(image.is_none())
}

pub async fn handle_sandbox_created(pool: &PgPool, image_name: &str, organization_id: Uuid) {
    if let Ok(Some(image)) =
        repositories::image::find_active_by_name(pool, image_name, Some(organization_id)).await
        && let Err(e) = repositories::image::update_last_used(pool, image.id).await
    {
        tracing::warn!(image_id = %image.id, error = %e, "failed to update image last used timestamp");
    }
}

pub async fn update_image_state(
    pool: &PgPool,
    image_id: Uuid,
    state: ImageState,
    error_reason: Option<&str>,
    realtime: &Realtime,
) -> Result<()> {
    let image = repositories::image::find_by_id(pool, image_id)
        .await?
        .ok_or(AppError::NotFound(format!("image {image_id} not found")))?;

    let old_state = image.state;

    match error_reason {
        Some(reason) => {
            repositories::image::update_state_with_error(pool, image_id, state, reason).await?;
        }
        None => {
            repositories::image::update_state(pool, image_id, state).await?;
        }
    }

    if let Some(org_id) = image.organization_id {
        let updated = Image {
            state,
            error_reason: error_reason.map(String::from),
            ..image
        };
        let build_info = match &updated.build_info_image_ref {
            Some(r) => repositories::build_info::find_by_ref(pool, r).await?,
            None => None,
        };
        realtime.image_state_updated(
            org_id,
            &ImageDto::from_image(&updated, build_info.as_ref()),
            old_state,
            state,
        );
    }

    Ok(())
}

pub async fn sync_executor_images(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(guard)) = lock
        .acquire(
            lock_keys::image::SYNC_EXECUTOR_IMAGES,
            lock_ttls::image::SYNC_EXECUTOR_IMAGES,
        )
        .await
    else {
        return;
    };

    let mut redis = infra.redis.clone();

    let skip: i64 = redis::cmd("GET")
        .arg("sync-executor-images-skip")
        .query_async::<Option<String>>(&mut redis)
        .await
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let org_ids = match repositories::organization::find_non_suspended_ids(&infra.pool).await {
        Ok(ids) => ids,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch non-suspended org ids");
            return;
        }
    };

    let images = match repositories::image::find_by_state_and_organizations(
        &infra.pool,
        ImageState::Active,
        &org_ids,
        100,
        skip,
    )
    .await
    {
        Ok(imgs) => imgs,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch active images for sync");
            return;
        }
    };

    if images.is_empty() {
        let _: std::result::Result<(), _> = redis::cmd("SET")
            .arg("sync-executor-images-skip")
            .arg(0)
            .query_async(&mut redis)
            .await;
        return;
    }

    let new_skip = skip + images.len() as i64;
    let _: std::result::Result<(), _> = redis::cmd("SET")
        .arg("sync-executor-images-skip")
        .arg(new_skip)
        .query_async(&mut redis)
        .await;

    for image in &images {
        if let Some(ref internal_name) = image.internal_name
            && let Err(e) = propagate_image_to_executors(&infra.pool, internal_name).await
        {
            tracing::error!(
                image_id = %image.id,
                error = %e,
                "error propagating image to executors"
            );
        }
    }

    drop(guard);
}

async fn propagate_image_to_executors(pool: &PgPool, internal_image_name: &str) -> Result<()> {
    let executors = repositories::executor::find_ready_schedulable(pool).await?;

    let image_executors =
        repositories::executor::find_image_executors_by_ref(pool, internal_image_name).await?;
    let existing_executor_ids: std::collections::HashSet<Uuid> = image_executors
        .iter()
        .filter(|ie| {
            matches!(
                ie.state,
                ImageExecutorState::Ready | ImageExecutorState::PullingImage
            )
        })
        .map(|ie| ie.executor_id)
        .collect();

    let propagate_limit = ((executors.len() as f64 / 3.0).ceil() as usize)
        .saturating_sub(existing_executor_ids.len());

    let mut unallocated: Vec<&Executor> = executors
        .iter()
        .filter(|e| !existing_executor_ids.contains(&e.id))
        .collect();

    unallocated.shuffle(&mut rand::rng());
    let to_propagate = &unallocated[..unallocated.len().min(propagate_limit)];

    for exec in to_propagate {
        let existing =
            repositories::executor::find_image_executor(pool, exec.id, internal_image_name).await?;

        match existing {
            Some(ie) => {
                if ie.state == ImageExecutorState::PullingImage
                    && let Err(e) = handle_image_executor_pulling(pool, &ie).await
                {
                    tracing::error!(
                        image_executor_id = %ie.id,
                        error = %e,
                        "error handling pulling image executor"
                    );
                }
            }
            None => {
                let ie = repositories::executor::create_image_executor(
                    pool,
                    exec.id,
                    internal_image_name,
                    ImageExecutorState::PullingImage,
                    None,
                )
                .await;

                match ie {
                    Ok(_) => {
                        if let Err(e) =
                            propagate_image_to_executor(pool, internal_image_name, exec).await
                        {
                            tracing::error!(
                                executor_id = %exec.id,
                                error = %e,
                                "error propagating image to executor"
                            );
                            if let Err(db_err) =
                                repositories::executor::update_image_executor_error(
                                    pool,
                                    exec.id,
                                    ImageExecutorState::Error,
                                    &e.to_string(),
                                )
                                .await
                            {
                                tracing::warn!(executor_id = %exec.id, error = %db_err, "failed to record image executor error");
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            executor_id = %exec.id,
                            error = %e,
                            "failed to create image executor record"
                        );
                    }
                }
            }
        }
    }

    Ok(())
}

async fn propagate_image_to_executor(
    pool: &PgPool,
    internal_image_name: &str,
    exec: &Executor,
) -> Result<()> {
    let registry = find_registry_for_image(pool, internal_image_name).await?;
    let adapter = executor::create_adapter(exec)?;
    adapter
        .pull_image(internal_image_name, registry.as_ref())
        .await
}

async fn find_registry_for_image(pool: &PgPool, image_name: &str) -> Result<Option<Registry>> {
    if let Some(reg) = registry_service::find_by_image_name(pool, image_name, None).await? {
        return Ok(Some(reg));
    }

    let internal =
        repositories::registry::find_default_by_type(pool, RegistryType::Internal).await?;

    Ok(internal)
}

pub async fn sync_executor_image_states(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(guard)) = lock
        .acquire(
            lock_keys::image::SYNC_EXECUTOR_IMAGE_STATES,
            lock_ttls::image::SYNC_EXECUTOR_IMAGE_STATES,
        )
        .await
    else {
        return;
    };

    let states = &[
        ImageExecutorState::PullingImage,
        ImageExecutorState::BuildingImage,
        ImageExecutorState::Removing,
    ];

    let executor_images = match repositories::executor::find_image_executors_by_states(
        &infra.pool,
        states,
        100,
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch image executors for sync");
            return;
        }
    };

    for ie in &executor_images {
        if let Err(e) = sync_single_executor_image_state(&infra.pool, ie).await {
            let msg = e.to_string();
            if msg.contains("ECONNRESET") || msg.contains("connection reset") {
                continue;
            }
            if msg.contains("executor") && msg.contains("not ready") {
                tracing::debug!(
                    image_executor_id = %ie.id,
                    "executor not ready while syncing image executor"
                );
                continue;
            }
            tracing::error!(
                image_executor_id = %ie.id,
                error = %e,
                "error syncing executor image state"
            );
            if let Err(db_err) = repositories::executor::update_image_executor_error(
                &infra.pool,
                ie.id,
                ImageExecutorState::Error,
                &e.to_string(),
            )
            .await
            {
                tracing::warn!(image_executor_id = %ie.id, error = %db_err, "failed to record image executor error");
            }
        }
    }

    drop(guard);
}

async fn sync_single_executor_image_state(pool: &PgPool, ie: &ImageExecutor) -> Result<()> {
    let Some(executor) = repositories::executor::find_by_id(pool, ie.executor_id).await? else {
        repositories::executor::delete_image_executor(pool, ie.id).await?;
        tracing::warn!(
            executor_id = %ie.executor_id,
            image_executor_id = %ie.id,
            "executor not found, removed image executor"
        );
        return Ok(());
    };

    if executor.state != ExecutorState::Ready {
        repositories::executor::delete_image_executor(pool, ie.id).await?;
        return Err(AppError::BadRequest(format!(
            "executor {} is not ready",
            executor.id
        )));
    }

    match ie.state {
        ImageExecutorState::PullingImage => handle_image_executor_pulling(pool, ie).await?,
        ImageExecutorState::BuildingImage => handle_image_executor_building(pool, ie).await?,
        ImageExecutorState::Removing => handle_image_executor_removing(pool, ie).await?,
        _ => {}
    }

    Ok(())
}

async fn handle_image_executor_pulling(pool: &PgPool, ie: &ImageExecutor) -> Result<()> {
    let executor_id = ie.executor_id;
    let executor = repositories::executor::find_by_id(pool, executor_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("executor not found"))?;

    let adapter = executor::create_adapter(&executor)?;
    let exists = adapter.image_exists(&ie.image_ref).await?;

    if exists {
        repositories::executor::update_image_executor_state(
            pool,
            &ie.image_ref,
            ImageExecutorState::Ready,
        )
        .await?;
        return Ok(());
    }

    let timeout = chrono::Duration::minutes(60);
    if Utc::now() - ie.created_at > timeout {
        repositories::executor::update_image_executor_error(
            pool,
            ie.id,
            ImageExecutorState::Error,
            "timeout while pulling image",
        )
        .await?;
        return Ok(());
    }

    let retry_timeout = chrono::Duration::minutes(10);
    if Utc::now() - ie.created_at > retry_timeout {
        retry_image_executor_pull(pool, ie).await?;
    }

    Ok(())
}

async fn handle_image_executor_building(pool: &PgPool, ie: &ImageExecutor) -> Result<()> {
    let executor_id = ie.executor_id;
    let executor = repositories::executor::find_by_id(pool, executor_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("executor not found"))?;

    let adapter = executor::create_adapter(&executor)?;
    let exists = adapter.image_exists(&ie.image_ref).await?;

    if exists {
        repositories::executor::update_image_executor_state(
            pool,
            &ie.image_ref,
            ImageExecutorState::Ready,
        )
        .await?;
    }

    Ok(())
}

async fn handle_image_executor_removing(pool: &PgPool, ie: &ImageExecutor) -> Result<()> {
    let executor_id = ie.executor_id;
    let Some(executor) = repositories::executor::find_by_id(pool, executor_id).await? else {
        if let Err(e) = repositories::executor::delete_image_executor(pool, ie.id).await {
            tracing::warn!(image_executor_id = %ie.id, error = %e, "failed to delete orphaned image executor");
        }
        tracing::warn!(
            executor_id = %ie.executor_id,
            "executor not found while removing image, deleted image executor"
        );
        return Ok(());
    };

    let adapter = executor::create_adapter(&executor)?;
    let exists = adapter.image_exists(&ie.image_ref).await?;

    if exists {
        if let Err(e) = adapter.remove_image(&ie.image_ref).await {
            tracing::warn!(
                executor_id = %executor.id,
                image_ref = %ie.image_ref,
                error = %e,
                "failed to remove image from executor, deleting image executor record"
            );
            if let Err(db_err) = repositories::executor::delete_image_executor(pool, ie.id).await {
                tracing::warn!(image_executor_id = %ie.id, error = %db_err, "failed to delete image executor after removal failure");
            }
        }
    } else {
        repositories::executor::delete_image_executor(pool, ie.id).await?;
    }

    Ok(())
}

async fn retry_image_executor_pull(pool: &PgPool, ie: &ImageExecutor) -> Result<()> {
    let executor_id = ie.executor_id;
    let executor = repositories::executor::find_by_id(pool, executor_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("executor not found"))?;

    let adapter = executor::create_adapter(&executor)?;
    let registry =
        repositories::registry::find_default_by_type(pool, RegistryType::Internal).await?;

    adapter.pull_image(&ie.image_ref, registry.as_ref()).await?;

    Ok(())
}

pub async fn check_image_cleanup(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(guard)) = lock
        .acquire(
            lock_keys::image::CHECK_CLEANUP,
            lock_ttls::image::CHECK_CLEANUP,
        )
        .await
    else {
        return;
    };

    let images = match repositories::image::find_by_state(&infra.pool, ImageState::Removing).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch removing images");
            return;
        }
    };

    for image in &images {
        if let Some(ref internal_name) = image.internal_name
            && let Err(e) = repositories::executor::update_image_executor_state(
                &infra.pool,
                internal_name,
                ImageExecutorState::Removing,
            )
            .await
        {
            tracing::warn!(error = %e, "failed to mark image executors as removing");
        }
        if repositories::image::delete(&infra.pool, image.id)
            .await
            .is_ok()
            && let Some(org_id) = image.organization_id
        {
            infra.realtime.image_removed(org_id, image.id);
        }
    }

    drop(guard);
}

pub async fn check_image_states(infra: &Infra) {
    let lock = &infra.lock;

    let docker = match infra.require_docker() {
        Ok(d) => d,
        Err(_) => return,
    };

    let images = match repositories::image::find_in_processing_states(&infra.pool).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch processing images");
            return;
        }
    };

    for image in &images {
        let lock_key = lock_keys::image::check_state(&image.id.to_string());
        let Ok(Some(guard)) = lock.acquire(&lock_key, lock_ttls::image::CHECK_STATE).await else {
            continue;
        };

        let result = match image.state {
            ImageState::BuildPending => {
                update_image_state(
                    &infra.pool,
                    image.id,
                    ImageState::Building,
                    None,
                    &infra.realtime,
                )
                .await
            }
            ImageState::Building => {
                handle_image_state_building(&infra.pool, image, &infra.realtime).await
            }
            ImageState::Pending => {
                handle_image_state_pending(&infra.pool, image, docker, &infra.realtime).await
            }
            ImageState::Pulling => {
                handle_image_state_pulling(&infra.pool, image, docker, &infra.realtime).await
            }
            ImageState::PendingValidation => {
                handle_image_state_pending_validation(&infra.pool, image, docker, &infra.realtime)
                    .await
            }
            ImageState::Validating => {
                handle_image_state_validating(&infra.pool, image, docker, &infra.realtime).await
            }
            ImageState::Removing => {
                handle_image_state_removing(&infra.pool, image, &infra.realtime).await
            }
            _ => Ok(()),
        };

        if let Err(e) = result {
            let msg = e.to_string();
            if msg.contains("ECONNRESET") || msg.contains("connection reset") {
                drop(guard);
                continue;
            }
            if let Err(db_err) = update_image_state(
                &infra.pool,
                image.id,
                ImageState::Error,
                Some(&msg),
                &infra.realtime,
            )
            .await
            {
                tracing::warn!(image_id = %image.id, error = %db_err, "failed to persist image error state");
            }
        }

        drop(guard);
    }
}

async fn handle_image_state_building(
    pool: &PgPool,
    image: &Image,
    realtime: &Realtime,
) -> Result<()> {
    let timeout = chrono::Duration::minutes(30);
    if Utc::now() - image.created_at > timeout {
        update_image_state(
            pool,
            image.id,
            ImageState::BuildFailed,
            Some("timeout while building image"),
            realtime,
        )
        .await?;
        return Ok(());
    }

    let build_info = match &image.build_info_image_ref {
        Some(r) => repositories::build_info::find_by_ref(pool, r).await?,
        None => None,
    };

    let Some(build_info) = build_info else {
        update_image_state(
            pool,
            image.id,
            ImageState::BuildFailed,
            Some("missing build information"),
            realtime,
        )
        .await?;
        return Ok(());
    };

    let excluded = executor_service::get_executors_with_multiple_images_building(
        pool,
        MAX_CONCURRENT_IMAGE_BUILDS_PER_EXECUTOR,
    )
    .await?;

    let Ok(exec) = executor_service::get_random_available(
        pool,
        &executor_service::GetExecutorParams {
            region: None,
            sandbox_class: None,
            image_ref: None,
            excluded_executor_ids: &excluded,
        },
    )
    .await
    else {
        return Ok(());
    };

    repositories::image::update_build_details(
        pool,
        image.id,
        None,
        None,
        None,
        Some(&exec.id.to_string()),
    )
    .await?;

    let registry =
        repositories::registry::find_default_by_type(pool, RegistryType::Internal).await?;

    let adapter = executor::create_adapter(&exec)?;
    adapter
        .build_image(
            &build_info,
            image
                .organization_id
                .as_ref()
                .map(|id| id.to_string())
                .as_deref(),
            registry.as_ref(),
            Some(true),
        )
        .await
        .map_err(|e| AppError::Internal(format!("error building image {}: {e}", image.name)))?;

    let internal_name = if let Some(ref reg) = registry {
        format!("{}/{}/{}", reg.url, reg.project, build_info.image_ref)
    } else {
        build_info.image_ref.clone()
    };

    repositories::image::update_build_details(
        pool,
        image.id,
        Some(&internal_name),
        None,
        None,
        None,
    )
    .await?;

    tokio::time::sleep(Duration::from_secs(30)).await;

    update_image_state(pool, image.id, ImageState::Pending, None, realtime).await?;

    Ok(())
}

async fn handle_image_state_pending(
    pool: &PgPool,
    image: &Image,
    docker: &DockerClient,
    realtime: &Realtime,
) -> Result<()> {
    update_image_state(pool, image.id, ImageState::Pulling, None, realtime).await?;

    let local_image_name = effective_image_name(image);

    let registry = if image.build_info_image_ref.is_some() {
        repositories::registry::find_default_by_type(pool, RegistryType::Internal).await?
    } else {
        registry_service::find_by_image_name(pool, &image.image_name, image.organization_id).await?
    };

    docker
        .pull_image(local_image_name, registry.as_ref())
        .await
        .map_err(|e| AppError::Internal(format!("failed to pull image: {e}")))?;

    Ok(())
}

async fn handle_image_state_pulling(
    pool: &PgPool,
    image: &Image,
    docker: &DockerClient,
    realtime: &Realtime,
) -> Result<()> {
    let local_image_name = effective_image_name(image);

    let timeout = chrono::Duration::minutes(15);
    if Utc::now() - image.created_at > timeout {
        update_image_state(
            pool,
            image.id,
            ImageState::Error,
            Some("timeout while pulling image"),
            realtime,
        )
        .await?;
        return Ok(());
    }

    if !docker.image_exists(local_image_name).await {
        return Ok(());
    }

    tokio::time::sleep(Duration::from_secs(30)).await;

    let org = match image.organization_id {
        Some(org_id) => repositories::organization::find_by_id(pool, org_id).await?,
        None => None,
    };

    let max_image_size = org.as_ref().map_or(10, |o| o.max_image_size);

    let image_info = docker
        .get_image_info(local_image_name)
        .await
        .map_err(|e| AppError::Internal(format!("failed to get image info: {e}")))?;

    if image_info.size_gb > max_image_size as f64 {
        update_image_state(
            pool,
            image.id,
            ImageState::Error,
            Some(&format!(
                "image size ({:.2}GB) exceeds maximum allowed size of {max_image_size}GB",
                image_info.size_gb
            )),
            realtime,
        )
        .await?;
        return Ok(());
    }

    let entrypoint = if image.entrypoint.is_some() {
        image.entrypoint.clone()
    } else {
        image_info
            .entrypoint
            .or_else(|| Some(vec!["sleep".into(), "infinity".into()]))
    };

    repositories::image::update_build_details(
        pool,
        image.id,
        None,
        Some(image_info.size_gb as f32),
        entrypoint.as_deref(),
        None,
    )
    .await?;

    update_image_state(
        pool,
        image.id,
        ImageState::PendingValidation,
        None,
        realtime,
    )
    .await?;

    Ok(())
}

async fn handle_image_state_pending_validation(
    pool: &PgPool,
    image: &Image,
    docker: &DockerClient,
    realtime: &Realtime,
) -> Result<()> {
    let local_image_name = effective_image_name(image);

    if !docker.image_exists(local_image_name).await {
        return Ok(());
    }

    update_image_state(pool, image.id, ImageState::Validating, None, realtime).await?;

    Ok(())
}

async fn handle_image_state_validating(
    pool: &PgPool,
    image: &Image,
    docker: &DockerClient,
    realtime: &Realtime,
) -> Result<()> {
    let timeout = chrono::Duration::minutes(10);
    if Utc::now() - image.created_at > timeout {
        update_image_state(
            pool,
            image.id,
            ImageState::Error,
            Some("timeout while validating image"),
            realtime,
        )
        .await?;
        return Ok(());
    }

    validate_image_runtime(docker, image).await.map_err(|e| {
        let msg = e.to_string();
        if msg.contains("404") || msg.to_lowercase().contains("no such image") {
            return AppError::Internal("image not found during validation".into());
        }
        AppError::Internal(format!("validation failed: {msg}"))
    })?;

    if image.build_info_image_ref.is_none() {
        let internal_name = push_image_to_internal_registry(pool, docker, image).await?;
        repositories::image::update_build_details(
            pool,
            image.id,
            Some(&internal_name),
            None,
            None,
            None,
        )
        .await?;
    }

    let fresh = repositories::image::find_by_id(pool, image.id)
        .await?
        .ok_or(AppError::NotFound(format!("image {} not found", image.id)))?;

    if let Some(ref internal_name) = fresh.internal_name {
        let exec = match repositories::executor::find_ready_schedulable(pool).await {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(error = %e, "failed to find schedulable executors for initial propagation");
                vec![]
            }
        };
        if let Some(first) = exec.first()
            && let Err(e) = propagate_image_to_executor(pool, internal_name, first).await
        {
            tracing::warn!(executor_id = %first.id, error = %e, "failed initial image propagation to executor");
        }
    }

    update_image_state(pool, image.id, ImageState::Active, None, realtime).await?;

    if let Ok(Some(registry)) =
        registry_service::find_by_image_name(pool, &image.image_name, image.organization_id).await
        && registry.registry_type == RegistryType::Transient
        && let Err(e) = registry_service::remove_image(pool, &image.image_name, registry.id).await
    {
        tracing::warn!(image_id = %image.id, error = %e, "failed to remove image from transient registry");
    }

    Ok(())
}

async fn handle_image_state_removing(
    pool: &PgPool,
    image: &Image,
    realtime: &Realtime,
) -> Result<()> {
    if let Some(ref internal_name) = image.internal_name {
        let ie_count = repositories::executor::find_image_executors_by_ref(pool, internal_name)
            .await?
            .len();
        if ie_count > 0 {
            return Ok(());
        }
    }

    repositories::image::delete(pool, image.id).await?;

    if let Some(org_id) = image.organization_id {
        realtime.image_removed(org_id, image.id);
    }

    Ok(())
}

async fn validate_image_runtime(docker: &DockerClient, image: &Image) -> Result<()> {
    let local_image_name = effective_image_name(image);

    let container_id = docker
        .create_container(local_image_name, image.entrypoint.clone())
        .await?;

    let result = async {
        let start = std::time::Instant::now();
        let check_duration = Duration::from_secs(60);

        while start.elapsed() < check_duration {
            if !docker.is_running(&container_id).await {
                anyhow::bail!("container exited");
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }

        Ok(())
    }
    .await;

    if let Err(e) = docker.remove_container(&container_id).await {
        tracing::warn!(container_id = %container_id, error = %e, "failed to remove docker container");
    }

    Ok(result?)
}

async fn push_image_to_internal_registry(
    pool: &PgPool,
    docker: &DockerClient,
    image: &Image,
) -> Result<String> {
    let registry = repositories::registry::find_default_by_type(pool, RegistryType::Internal)
        .await?
        .ok_or(AppError::Internal(
            "no default internal registry configured".into(),
        ))?;

    let tag = image
        .image_name
        .rsplit_once(':')
        .map(|(_, t)| t)
        .unwrap_or("latest");

    let registry_host = registry
        .url
        .trim_start_matches("https://")
        .trim_start_matches("http://");

    let internal_name = format!("{}/{}/{}:{tag}", registry_host, registry.project, image.id);

    docker
        .tag_image(&image.image_name, &internal_name)
        .await
        .map_err(|e| AppError::Internal(format!("failed to tag image: {e}")))?;

    docker
        .push_image(&internal_name, &registry)
        .await
        .map_err(|e| AppError::Internal(format!("failed to push image: {e}")))?;

    Ok(internal_name)
}

pub async fn cleanup_old_build_info(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(guard)) = lock
        .acquire(
            lock_keys::image::CLEANUP_OLD_BUILD_INFO,
            lock_ttls::image::CLEANUP_OLD_BUILD_INFO,
        )
        .await
    else {
        return;
    };

    let one_day_ago = Utc::now() - chrono::Duration::days(1);
    let old_build_infos =
        match repositories::build_info::find_older_than(&infra.pool, one_day_ago).await {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(error = %e, "failed to fetch old build infos");
                return;
            }
        };

    if old_build_infos.is_empty() {
        drop(guard);
        return;
    }

    let image_refs: Vec<String> = old_build_infos
        .iter()
        .map(|bi| bi.image_ref.clone())
        .collect();

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
                "marked image executors for removal due to unused build info"
            );
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to mark old build info image executors for removal");
        }
        _ => {}
    }

    drop(guard);
}

pub async fn deactivate_old_images(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(guard)) = lock
        .acquire(
            lock_keys::image::DEACTIVATE_OLD_IMAGES,
            lock_ttls::image::DEACTIVATE_OLD_IMAGES,
        )
        .await
    else {
        return;
    };

    let two_weeks_ago = Utc::now() - chrono::Duration::weeks(2);

    let old_images =
        match repositories::image::find_old_inactive(&infra.pool, two_weeks_ago, 100).await {
            Ok(v) => v,
            Err(e) => {
                tracing::error!(error = %e, "failed to fetch old images for deactivation");
                return;
            }
        };

    if old_images.is_empty() {
        drop(guard);
        return;
    }

    let image_ids: Vec<Uuid> = old_images.iter().map(|i| i.id).collect();
    if let Err(e) =
        repositories::image::bulk_update_state_by_ids(&infra.pool, &image_ids, ImageState::Inactive)
            .await
    {
        tracing::warn!(error = %e, "failed to bulk-update old images to inactive");
    }

    let internal_names: Vec<String> = old_images
        .iter()
        .filter_map(|i| i.internal_name.clone())
        .collect();

    if !internal_names.is_empty() {
        match repositories::executor::bulk_update_image_executor_state_by_refs(
            &infra.pool,
            &internal_names,
            ImageExecutorState::Removing,
        )
        .await
        {
            Ok(count) => {
                tracing::debug!(
                    images = old_images.len(),
                    executors = count,
                    "deactivated old images and marked image executors for removal"
                );
            }
            Err(e) => {
                tracing::error!(error = %e, "failed to mark image executors for removal during deactivation");
            }
        }
    }

    drop(guard);
}

pub async fn cleanup_inactive_from_executors(infra: &Infra) {
    let lock = &infra.lock;

    let Ok(Some(guard)) = lock
        .acquire(
            lock_keys::image::CLEANUP_INACTIVE_FROM_EXECUTORS,
            lock_ttls::image::CLEANUP_INACTIVE_FROM_EXECUTORS,
        )
        .await
    else {
        return;
    };

    let images = match repositories::image::find_inactive_with_active_executors(&infra.pool, 100)
        .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch inactive images with active executors");
            return;
        }
    };

    let internal_names: Vec<String> = images
        .iter()
        .filter_map(|i| i.internal_name.clone())
        .collect();

    if !internal_names.is_empty() {
        match repositories::executor::bulk_update_image_executor_state_by_refs(
            &infra.pool,
            &internal_names,
            ImageExecutorState::Removing,
        )
        .await
        {
            Ok(count) => {
                tracing::debug!(
                    count,
                    "marked image executors for removal from inactive images"
                );
            }
            Err(e) => {
                tracing::error!(
                    error = %e,
                    "failed to cleanup inactive images from executors"
                );
            }
        }
    }

    drop(guard);
}

pub async fn cleanup_local_images(docker: &DockerClient) {
    if let Err(e) = docker.prune_images().await {
        tracing::warn!(error = %e, "failed to prune local docker images");
    }
}

fn effective_image_name(image: &Image) -> &str {
    if image.build_info_image_ref.is_some() {
        image.internal_name.as_deref().unwrap_or(&image.image_name)
    } else {
        &image.image_name
    }
}
