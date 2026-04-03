// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;

use rand::Rng;
use sqlx::PgPool;
use uuid::Uuid;

use crate::constants::billing::get_tier_for_balance;
use crate::constants::sandbox::{
    DEFAULT_AUTO_ARCHIVE_INTERVAL, DEFAULT_AUTO_STOP_INTERVAL, WARM_POOL_UNASSIGNED_ORGANIZATION,
};
use crate::infra::Infra;
use crate::models::{Organization, Sandbox, WarmPool};
use crate::repositories;
use crate::schemas::sandbox::{
    CreateSandboxDto, PaginatedSandboxesDto, PortPreviewUrlDto, SandboxDto,
};
use crate::services::executor::{self, GetExecutorParams};
use crate::services::image;
use crate::services::sandbox_actions;
use crate::services::warm_pool::{self, FetchWarmPoolSandboxParams};
use snapflow_errors::{AppError, Result};
use snapflow_models::{
    BackupState, ExecutorState, ImageState, SandboxClass, SandboxDesiredState, SandboxState,
};

use crate::constants::sandbox::{
    DEFAULT_SANDBOX_CPU, DEFAULT_SANDBOX_DISK, DEFAULT_SANDBOX_GPU, DEFAULT_SANDBOX_MEMORY,
};

pub async fn get_executor_domain(
    pool: &PgPool,
    executor_id: Option<Uuid>,
) -> Result<Option<String>> {
    let Some(eid) = executor_id else {
        return Ok(None);
    };
    Ok(repositories::executor::find_by_id(pool, eid)
        .await?
        .map(|e| e.domain))
}

pub async fn get_sandbox(pool: &PgPool, sandbox_id: Uuid) -> Result<Sandbox> {
    repositories::sandbox::find_by_id(pool, sandbox_id)
        .await?
        .ok_or_else(|| AppError::entity_not_found("sandbox", sandbox_id))
}

pub fn max_auto_stop_interval_for_balance(wallet_balance: f64) -> i32 {
    let tier = get_tier_for_balance(wallet_balance);
    if tier.max_sandbox_lifetime_seconds < 0 {
        return 0;
    }
    (tier.max_sandbox_lifetime_seconds / 60) as i32
}

pub async fn validate_organization_quotas(
    infra: &Infra,
    organization: &Organization,
    cpu: i32,
    mem: i32,
    disk: i32,
    exclude_sandbox_id: Option<Uuid>,
) -> Result<()> {
    if organization.suspended {
        return Err(AppError::Forbidden("organization is suspended".into()));
    }

    if organization.wallet_balance <= 0.0 {
        return Err(AppError::Forbidden("insufficient wallet balance".into()));
    }

    let tier = get_tier_for_balance(organization.wallet_balance);

    if tier.max_cpu_per_sandbox > 0 && cpu > tier.max_cpu_per_sandbox {
        return Err(AppError::Forbidden(format!(
            "CPU request {cpu} exceeds {} tier limit ({})",
            tier.name, tier.max_cpu_per_sandbox
        )));
    }
    if tier.max_memory_per_sandbox > 0 && mem > tier.max_memory_per_sandbox {
        return Err(AppError::Forbidden(format!(
            "memory request {mem}MB exceeds {} tier limit ({}MB)",
            tier.name, tier.max_memory_per_sandbox
        )));
    }
    if tier.max_disk_per_sandbox > 0 && disk > tier.max_disk_per_sandbox {
        return Err(AppError::Forbidden(format!(
            "disk request {disk}GB exceeds {} tier limit ({}GB)",
            tier.name, tier.max_disk_per_sandbox
        )));
    }

    if tier.max_concurrent_sandboxes > 0 {
        let active_count =
            repositories::sandbox::count_active_by_organization(&infra.pool, organization.id)
                .await
                .unwrap_or(0);
        if active_count >= i64::from(tier.max_concurrent_sandboxes) {
            return Err(AppError::Forbidden(format!(
                "concurrent sandbox limit reached ({} for {} tier)",
                tier.max_concurrent_sandboxes, tier.name
            )));
        }
    }

    let mut redis_conn = infra.redis.clone();
    crate::infra::pending_usage::increment(&mut redis_conn, organization.id, cpu, mem, disk)
        .await
        .map_err(|e| AppError::Internal(format!("failed to track pending usage: {e}")))?;

    let result = validate_quotas_inner(infra, organization, tier, exclude_sandbox_id).await;

    if result.is_err() {
        if let Err(e) = crate::infra::pending_usage::decrement(
            &mut redis_conn,
            organization.id,
            Some(cpu),
            Some(mem),
            Some(disk),
        )
        .await
        {
            tracing::error!(org_id = %organization.id, error = %e, "failed to rollback pending usage");
        }
        return result;
    }

    result
}

async fn validate_quotas_inner(
    infra: &Infra,
    organization: &Organization,
    tier: &crate::constants::billing::Tier,
    exclude_sandbox_id: Option<Uuid>,
) -> Result<()> {
    let (used_disk, used_cpu, used_mem) =
        repositories::sandbox::get_quota_usage(&infra.pool, organization.id, exclude_sandbox_id)
            .await?;

    let mut redis_conn = infra.redis.clone();
    let (pending_cpu, pending_mem, pending_disk) =
        crate::infra::pending_usage::get_pending(&mut redis_conn, organization.id)
            .await
            .unwrap_or((0, 0, 0));

    if tier.max_storage_total > 0 && used_disk + pending_disk > i64::from(tier.max_storage_total) {
        return Err(AppError::Forbidden(format!(
            "total storage exceeded ({}GB > {}GB for {} tier)",
            used_disk + pending_disk,
            tier.max_storage_total,
            tier.name
        )));
    }

    if tier.max_cpu_per_sandbox > 0
        && used_cpu + pending_cpu
            > i64::from(tier.max_concurrent_sandboxes) * i64::from(tier.max_cpu_per_sandbox)
    {
        return Err(AppError::Forbidden(format!(
            "total CPU quota exceeded for {} tier",
            tier.name
        )));
    }

    if tier.max_memory_per_sandbox > 0
        && used_mem + pending_mem
            > i64::from(tier.max_concurrent_sandboxes) * i64::from(tier.max_memory_per_sandbox)
    {
        return Err(AppError::Forbidden(format!(
            "total memory quota exceeded for {} tier",
            tier.name
        )));
    }

    Ok(())
}

pub async fn rollback_pending_usage(infra: &Infra, org_id: Uuid, cpu: i32, mem: i32, disk: i32) {
    let mut redis_conn = infra.redis.clone();
    if let Err(e) = crate::infra::pending_usage::decrement(
        &mut redis_conn,
        org_id,
        Some(cpu),
        Some(mem),
        Some(disk),
    )
    .await
    {
        tracing::error!(org_id = %org_id, error = %e, "failed to rollback pending usage");
    }
}

pub async fn create_from_image(
    infra: &Infra,
    organization: &Organization,
    req: &CreateSandboxDto,
) -> Result<SandboxDto> {
    let _lock = &infra.lock;
    let region = validated_region(req.target.as_deref());
    let sandbox_class = req.class.unwrap_or(SandboxClass::Small);

    let image_id_or_name = match &req.image {
        Some(img) if !img.trim().is_empty() => img.clone(),
        _ => infra.config.default_image.clone(),
    };

    let image = repositories::image::find_active_by_name(
        &infra.pool,
        &image_id_or_name,
        Some(organization.id),
    )
    .await?
    .ok_or(AppError::BadRequest(format!(
        "Image {image_id_or_name} not found. Did you add it through the Snapflow Dashboard?"
    )))?;

    if image.state != ImageState::Active {
        return Err(AppError::BadRequest(format!(
            "Image {image_id_or_name} is {}",
            image.state
        )));
    }

    let cpu = image.cpu;
    let mem = image.mem;
    let disk = image.disk;
    let gpu = image.gpu;

    validate_organization_quotas(infra, organization, cpu, mem, disk, None).await?;

    let has_buckets = req.buckets.as_ref().is_some_and(|b| !b.is_empty());

    if !has_buckets {
        let env: HashMap<String, String> = req.env.clone().unwrap_or_default();

        let warm_pool_result = warm_pool::fetch_warm_pool_sandbox(
            infra,
            &infra.config.default_image,
            &FetchWarmPoolSandboxParams {
                image: image_id_or_name.clone(),
                target: region.clone(),
                class: sandbox_class,
                cpu,
                mem,
                disk,
                os_user: req.user.clone().unwrap_or_else(|| "snapflow".into()),
                env,
                organization_id: organization.id,
            },
        )
        .await;

        if let Ok(Some(warm_sandbox)) = warm_pool_result {
            return assign_warm_pool_sandbox(infra, warm_sandbox, req, organization.id).await;
        }
    }

    let executor = {
        let with_image = executor::get_random_available(
            &infra.pool,
            &GetExecutorParams {
                region: Some(&region),
                sandbox_class: Some(sandbox_class),
                image_ref: image.internal_name.as_deref(),
                excluded_executor_ids: &[],
            },
        )
        .await;

        match with_image {
            Ok(exec) => Some(exec),
            Err(_) => executor::get_random_available(
                &infra.pool,
                &GetExecutorParams {
                    region: Some(&region),
                    sandbox_class: Some(sandbox_class),
                    image_ref: None,
                    excluded_executor_ids: &[],
                },
            )
            .await
            .ok(),
        }
    };

    let executor_id = executor.as_ref().map(|e| e.id);
    let executor_domain = executor.as_ref().map(|e| e.domain.clone());

    let env_value = serde_json::to_value(req.env.clone().unwrap_or_default())
        .map_err(|e| AppError::Internal(format!("failed to serialize env: {e}")))?;
    let labels_value = req
        .labels
        .as_ref()
        .map(serde_json::to_value)
        .transpose()
        .map_err(|e| AppError::Internal(format!("failed to serialize labels: {e}")))?;
    let buckets_value = serde_json::to_value(req.buckets.clone().unwrap_or_default())
        .map_err(|e| AppError::Internal(format!("failed to serialize buckets: {e}")))?;
    let auth_token = generate_auth_token();

    let auto_stop = req
        .auto_stop_interval
        .map(resolve_auto_stop_interval)
        .transpose()?
        .unwrap_or(DEFAULT_AUTO_STOP_INTERVAL);
    let auto_delete = req.auto_delete_interval.unwrap_or(-1);

    let sandbox = match repositories::sandbox::create(
        &infra.pool,
        &repositories::sandbox::CreateSandboxParams {
            organization_id: organization.id,
            executor_id,
            region: &region,
            class: sandbox_class,
            image: Some(&image.name),
            os_user: req.user.as_deref().unwrap_or("snapflow"),
            env: &env_value,
            labels: labels_value.as_ref(),
            public: req.public.unwrap_or(false),
            cpu,
            gpu,
            mem,
            disk,
            buckets: &buckets_value,
            auto_stop_interval: auto_stop,
            auto_archive_interval: req
                .auto_archive_interval
                .unwrap_or(DEFAULT_AUTO_ARCHIVE_INTERVAL),
            auto_delete_interval: auto_delete,
            auth_token: &auth_token,
            build_info_image_ref: None,
            network_block_all: req.network_block_all.unwrap_or(false),
            network_allow_list: req.network_allow_list.as_deref(),
        },
    )
    .await
    {
        Ok(s) => {
            rollback_pending_usage(infra, organization.id, cpu, mem, disk).await;
            s
        }
        Err(e) => {
            rollback_pending_usage(infra, organization.id, cpu, mem, disk).await;
            return Err(e.into());
        }
    };

    let toolbox_url = infra.toolbox_base_url();
    let response = SandboxDto::from_sandbox(&sandbox, executor_domain, None, &toolbox_url);

    infra.realtime.sandbox_created(organization.id, &response);

    image::handle_sandbox_created(&infra.pool, &image.name, organization.id).await;

    infra.task_tracker.spawn({
        let infra = infra.clone();
        let id = sandbox.id;
        async move {
            sandbox_actions::sync_instance_state(&infra, id).await;
        }
    });

    Ok(response)
}

pub async fn create_from_build_info(
    infra: &Infra,
    organization: &Organization,
    req: &CreateSandboxDto,
) -> Result<SandboxDto> {
    let region = validated_region(req.target.as_deref());
    let sandbox_class = req.class.unwrap_or(SandboxClass::Small);

    let cpu = req.cpu.unwrap_or(DEFAULT_SANDBOX_CPU);
    let mem = req.memory.unwrap_or(DEFAULT_SANDBOX_MEMORY);
    let disk = req.disk.unwrap_or(DEFAULT_SANDBOX_DISK);
    let gpu = req.gpu.unwrap_or(DEFAULT_SANDBOX_GPU);

    validate_organization_quotas(infra, organization, cpu, mem, disk, None).await?;

    let bi = req
        .build_info
        .as_ref()
        .ok_or(AppError::BadRequest("build_info is required".into()))?;

    let build_info_image_ref = image::generate_build_info_hash(
        &bi.dockerfile_content,
        bi.context_hashes.as_deref().unwrap_or_default(),
    );

    let existing =
        repositories::build_info::find_by_ref(&infra.pool, &build_info_image_ref).await?;
    if existing.is_some() {
        if let Err(e) =
            repositories::build_info::update_last_used(&infra.pool, &build_info_image_ref).await
        {
            tracing::warn!(error = %e, "failed to update build info last_used");
        }
    } else {
        repositories::build_info::upsert(
            &infra.pool,
            &build_info_image_ref,
            Some(&bi.dockerfile_content),
            bi.context_hashes.as_deref(),
        )
        .await?;
    }

    let env_value = serde_json::to_value(req.env.clone().unwrap_or_default())
        .map_err(|e| AppError::Internal(format!("failed to serialize env: {e}")))?;
    let labels_value = req
        .labels
        .as_ref()
        .map(serde_json::to_value)
        .transpose()
        .map_err(|e| AppError::Internal(format!("failed to serialize labels: {e}")))?;
    let buckets_value = serde_json::to_value(req.buckets.clone().unwrap_or_default())
        .map_err(|e| AppError::Internal(format!("failed to serialize buckets: {e}")))?;
    let auth_token = generate_auth_token();

    let auto_stop = req
        .auto_stop_interval
        .map(resolve_auto_stop_interval)
        .transpose()?
        .unwrap_or(DEFAULT_AUTO_STOP_INTERVAL);
    let auto_delete = req.auto_delete_interval.unwrap_or(-1);

    let executor_result = executor::get_random_available(
        &infra.pool,
        &GetExecutorParams {
            region: Some(&region),
            sandbox_class: Some(sandbox_class),
            image_ref: Some(&build_info_image_ref),
            excluded_executor_ids: &[],
        },
    )
    .await;

    let (executor_id, initial_state) = match executor_result {
        Ok(exec) => (Some(exec.id), SandboxState::Creating),
        Err(_) => (None, SandboxState::PendingBuild),
    };

    let sandbox = match repositories::sandbox::create(
        &infra.pool,
        &repositories::sandbox::CreateSandboxParams {
            organization_id: organization.id,
            executor_id,
            region: &region,
            class: sandbox_class,
            image: None,
            os_user: req.user.as_deref().unwrap_or("snapflow"),
            env: &env_value,
            labels: labels_value.as_ref(),
            public: req.public.unwrap_or(false),
            cpu,
            gpu,
            mem,
            disk,
            buckets: &buckets_value,
            auto_stop_interval: auto_stop,
            auto_archive_interval: req
                .auto_archive_interval
                .unwrap_or(DEFAULT_AUTO_ARCHIVE_INTERVAL),
            auto_delete_interval: auto_delete,
            auth_token: &auth_token,
            build_info_image_ref: Some(&build_info_image_ref),
            network_block_all: req.network_block_all.unwrap_or(false),
            network_allow_list: req.network_allow_list.as_deref(),
        },
    )
    .await
    {
        Ok(s) => {
            rollback_pending_usage(infra, organization.id, cpu, mem, disk).await;
            s
        }
        Err(e) => {
            rollback_pending_usage(infra, organization.id, cpu, mem, disk).await;
            return Err(e.into());
        }
    };

    if initial_state == SandboxState::PendingBuild
        && let Err(e) =
            repositories::sandbox::update_state(&infra.pool, sandbox.id, SandboxState::PendingBuild)
                .await
    {
        tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to update sandbox state to PendingBuild");
    }

    let executor_domain = get_executor_domain(&infra.pool, executor_id).await?;

    let build_info =
        repositories::build_info::find_by_ref(&infra.pool, &build_info_image_ref).await?;
    let toolbox_url = infra.toolbox_base_url();
    let response =
        SandboxDto::from_sandbox(&sandbox, executor_domain, build_info.as_ref(), &toolbox_url);

    infra.realtime.sandbox_created(organization.id, &response);

    infra.task_tracker.spawn({
        let infra = infra.clone();
        let id = sandbox.id;
        async move {
            sandbox_actions::sync_instance_state(&infra, id).await;
        }
    });

    Ok(response)
}

async fn assign_warm_pool_sandbox(
    infra: &Infra,
    sandbox: Sandbox,
    req: &CreateSandboxDto,
    organization_id: Uuid,
) -> Result<SandboxDto> {
    repositories::sandbox::update_organization(&infra.pool, sandbox.id, organization_id).await?;

    if req.public.unwrap_or(false)
        && let Err(e) = repositories::sandbox::update_public(&infra.pool, sandbox.id, true).await
    {
        tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to update public flag on warm pool sandbox");
    }

    if let Some(ref labels) = req.labels {
        let labels_value = serde_json::to_value(labels)
            .map_err(|e| AppError::Internal(format!("failed to serialize labels: {e}")))?;
        if let Err(e) =
            repositories::sandbox::update_labels(&infra.pool, sandbox.id, &labels_value).await
        {
            tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to update labels on warm pool sandbox");
        }
    }

    if let Some(interval) = req.auto_stop_interval {
        let resolved = resolve_auto_stop_interval(interval)?;
        if let Err(e) =
            repositories::sandbox::update_auto_stop_interval(&infra.pool, sandbox.id, resolved)
                .await
        {
            tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to update auto-stop interval on warm pool sandbox");
        }
    }

    if let Some(interval) = req.auto_delete_interval
        && let Err(e) =
            repositories::sandbox::update_auto_delete_interval(&infra.pool, sandbox.id, interval)
                .await
    {
        tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to update auto-delete interval on warm pool sandbox");
    }

    let executor_domain = get_executor_domain(&infra.pool, sandbox.executor_id).await?;

    let updated = repositories::sandbox::find_by_id(&infra.pool, sandbox.id)
        .await?
        .ok_or(AppError::Internal(
            "sandbox disappeared after assignment".into(),
        ))?;

    let toolbox_url = infra.toolbox_base_url();
    let response = SandboxDto::from_sandbox(&updated, executor_domain, None, &toolbox_url);

    infra
        .realtime
        .sandbox_organization_updated(organization_id, &response);

    infra.realtime.sandbox_state_updated(
        organization_id,
        &response,
        SandboxState::Started,
        SandboxState::Started,
    );

    warm_pool::handle_organization_updated(&infra.pool, &updated, organization_id).await;

    Ok(response)
}

pub async fn create_for_warm_pool(pool: &PgPool, warm_pool_item: &WarmPool) -> Result<Sandbox> {
    let image = repositories::image::find_active_by_name(
        pool,
        &warm_pool_item.image,
        Some(WARM_POOL_UNASSIGNED_ORGANIZATION),
    )
    .await?
    .ok_or(AppError::BadRequest(format!(
        "Image {} not found while creating warm pool sandbox",
        warm_pool_item.image
    )))?;

    let executor = executor::get_random_available(
        pool,
        &GetExecutorParams {
            region: Some(&warm_pool_item.target),
            sandbox_class: Some(warm_pool_item.class),
            image_ref: image.internal_name.as_deref(),
            excluded_executor_ids: &[],
        },
    )
    .await?;

    let auth_token = generate_auth_token();

    let sandbox = repositories::sandbox::create(
        pool,
        &repositories::sandbox::CreateSandboxParams {
            organization_id: WARM_POOL_UNASSIGNED_ORGANIZATION,
            executor_id: Some(executor.id),
            region: &warm_pool_item.target,
            class: warm_pool_item.class,
            image: Some(&warm_pool_item.image),
            os_user: "snapflow",
            env: &warm_pool_item.env,
            labels: None,
            public: false,
            cpu: warm_pool_item.cpu,
            gpu: warm_pool_item.gpu,
            mem: warm_pool_item.mem,
            disk: warm_pool_item.disk,
            buckets: &serde_json::Value::Array(vec![]),
            auto_stop_interval: 0,
            auto_archive_interval: 0,
            auto_delete_interval: 0,
            auth_token: &auth_token,
            build_info_image_ref: None,
            network_block_all: false,
            network_allow_list: None,
        },
    )
    .await?;

    Ok(sandbox)
}

pub async fn find_all(
    pool: &PgPool,
    organization_id: Uuid,
    labels: Option<&serde_json::Value>,
) -> Result<Vec<Sandbox>> {
    let sandboxes = match labels {
        Some(l) => {
            repositories::sandbox::find_by_organization_with_labels(pool, organization_id, l)
                .await?
        }
        None => repositories::sandbox::find_by_organization(pool, organization_id).await?,
    };
    Ok(sandboxes)
}

pub async fn find_all_paginated(
    infra: &Infra,
    organization_id: Uuid,
    page: i64,
    limit: i64,
    labels: Option<&serde_json::Value>,
) -> Result<PaginatedSandboxesDto> {
    let offset = (page - 1) * limit;
    let sandboxes = repositories::sandbox::find_by_organization_paginated(
        &infra.pool,
        organization_id,
        labels,
        limit,
        offset,
    )
    .await?;

    let total =
        repositories::sandbox::count_by_organization(&infra.pool, organization_id, labels).await?;

    let toolbox_url = infra.toolbox_base_url();
    let items: Vec<SandboxDto> = sandboxes
        .iter()
        .map(|s| SandboxDto::from_sandbox(s, None, None, &toolbox_url))
        .collect();

    Ok(PaginatedSandboxesDto {
        items,
        total,
        page,
        total_pages: (total + limit - 1) / limit,
    })
}

pub async fn get_port_preview_url(
    pool: &PgPool,
    sandbox_id: Uuid,
    port: u16,
) -> Result<PortPreviewUrlDto> {
    if port == 0 {
        return Err(AppError::BadRequest("invalid port".into()));
    }

    let sandbox = get_sandbox(pool, sandbox_id).await?;

    if sandbox.state != SandboxState::Started {
        return Err(AppError::BadRequest(
            "sandbox must be started to get port preview URL".into(),
        ));
    }

    let Some(executor_id) = sandbox.executor_id else {
        return Err(AppError::NotFound(format!(
            "executor not found for sandbox {sandbox_id}"
        )));
    };

    let executor = repositories::executor::find_by_id(pool, executor_id)
        .await?
        .ok_or(AppError::NotFound(format!(
            "executor not found for sandbox {sandbox_id}"
        )))?;

    Ok(PortPreviewUrlDto {
        url: format!("https://{port}-{sandbox_id}.{}", executor.domain),
        token: sandbox.auth_token,
        legacy_proxy_url: None,
    })
}

pub async fn destroy(infra: &Infra, sandbox_id: Uuid) -> Result<()> {
    let sandbox = get_sandbox(&infra.pool, sandbox_id).await?;

    let rows = repositories::sandbox::update_desired_state_conditional(
        &infra.pool,
        sandbox_id,
        SandboxDesiredState::Destroyed,
        sandbox.state,
    )
    .await?;

    if rows == 0 {
        return Err(AppError::BadRequest(
            "sandbox state change in progress".into(),
        ));
    }

    let toolbox_url = infra.toolbox_base_url();
    let response = SandboxDto::from_sandbox(&sandbox, None, None, &toolbox_url);
    infra.realtime.sandbox_desired_state_updated(
        sandbox.organization_id,
        &response,
        sandbox.desired_state,
        SandboxDesiredState::Destroyed,
    );

    infra.task_tracker.spawn({
        let infra = infra.clone();
        async move {
            sandbox_actions::sync_instance_state(&infra, sandbox_id).await;
        }
    });

    Ok(())
}

pub async fn archive(infra: &Infra, sandbox_id: Uuid) -> Result<()> {
    let sandbox = get_sandbox(&infra.pool, sandbox_id).await?;

    if !state_matches_desired(sandbox.state, sandbox.desired_state) {
        return Err(AppError::BadRequest("state change in progress".into()));
    }

    if sandbox.state != SandboxState::Stopped {
        return Err(AppError::BadRequest(
            "sandbox must be stopped before archiving".into(),
        ));
    }

    if sandbox.auto_delete_interval == 0 {
        return Err(AppError::BadRequest(
            "cannot archive ephemeral sandboxes".into(),
        ));
    }

    let rows = repositories::sandbox::update_desired_state_conditional(
        &infra.pool,
        sandbox_id,
        SandboxDesiredState::Archived,
        SandboxState::Stopped,
    )
    .await?;

    if rows == 0 {
        return Err(AppError::BadRequest(
            "sandbox state change in progress".into(),
        ));
    }

    let toolbox_url = infra.toolbox_base_url();
    let response = SandboxDto::from_sandbox(&sandbox, None, None, &toolbox_url);
    infra.realtime.sandbox_desired_state_updated(
        sandbox.organization_id,
        &response,
        sandbox.desired_state,
        SandboxDesiredState::Archived,
    );

    infra.task_tracker.spawn({
        let infra = infra.clone();
        async move {
            sandbox_actions::sync_instance_state(&infra, sandbox_id).await;
        }
    });

    Ok(())
}

pub async fn create_backup(pool: &PgPool, sandbox_id: Uuid) -> Result<()> {
    let sandbox = get_sandbox(pool, sandbox_id).await?;

    if sandbox.auto_delete_interval == 0 {
        return Err(AppError::BadRequest(
            "cannot create backup for ephemeral sandboxes".into(),
        ));
    }

    if !matches!(
        sandbox.backup_state,
        BackupState::Completed | BackupState::None
    ) {
        return Err(AppError::BadRequest(
            "sandbox backup is already in progress".into(),
        ));
    }

    repositories::sandbox::update_backup_state(pool, sandbox_id, BackupState::Pending).await?;

    Ok(())
}

pub async fn start(infra: &Infra, sandbox_id: Uuid, organization: &Organization) -> Result<()> {
    let sandbox = get_sandbox(&infra.pool, sandbox_id).await?;

    if !state_matches_desired(sandbox.state, sandbox.desired_state) {
        return Err(AppError::BadRequest("state change in progress".into()));
    }

    if !matches!(
        sandbox.state,
        SandboxState::Stopped | SandboxState::Archived
    ) {
        return Err(AppError::BadRequest("sandbox is not in valid state".into()));
    }

    if organization.suspended {
        return Err(AppError::Forbidden("organization is suspended".into()));
    }

    if sandbox.state == SandboxState::Archived {
        validate_organization_quotas(
            infra,
            organization,
            sandbox.cpu,
            sandbox.mem,
            sandbox.disk,
            Some(sandbox.id),
        )
        .await?;
    } else if let Some(executor_id) = sandbox.executor_id {
        let executor = repositories::executor::find_by_id(&infra.pool, executor_id)
            .await?
            .ok_or(AppError::NotFound("executor not found".into()))?;

        if executor.state != ExecutorState::Ready {
            return Err(AppError::BadRequest("executor is not ready".into()));
        }
    } else {
        validate_organization_quotas(
            infra,
            organization,
            sandbox.cpu,
            sandbox.mem,
            sandbox.disk,
            Some(sandbox.id),
        )
        .await?;
    }

    let rows = repositories::sandbox::update_desired_state_conditional(
        &infra.pool,
        sandbox_id,
        SandboxDesiredState::Started,
        sandbox.state,
    )
    .await?;

    if rows == 0 {
        return Err(AppError::BadRequest(
            "sandbox state change in progress".into(),
        ));
    }

    let toolbox_url = infra.toolbox_base_url();
    let response = SandboxDto::from_sandbox(&sandbox, None, None, &toolbox_url);
    infra.realtime.sandbox_desired_state_updated(
        sandbox.organization_id,
        &response,
        sandbox.desired_state,
        SandboxDesiredState::Started,
    );

    infra.task_tracker.spawn({
        let infra = infra.clone();
        async move {
            sandbox_actions::sync_instance_state(&infra, sandbox_id).await;
        }
    });

    Ok(())
}

pub async fn stop(infra: &Infra, sandbox_id: Uuid) -> Result<()> {
    let sandbox = get_sandbox(&infra.pool, sandbox_id).await?;

    if !state_matches_desired(sandbox.state, sandbox.desired_state) {
        return Err(AppError::BadRequest("state change in progress".into()));
    }

    if sandbox.state != SandboxState::Started {
        return Err(AppError::BadRequest("sandbox is not started".into()));
    }

    let new_desired = if sandbox.auto_delete_interval == 0 {
        SandboxDesiredState::Destroyed
    } else {
        SandboxDesiredState::Stopped
    };

    let rows = repositories::sandbox::update_desired_state_conditional(
        &infra.pool,
        sandbox_id,
        new_desired,
        SandboxState::Started,
    )
    .await?;

    if rows == 0 {
        return Err(AppError::BadRequest(
            "sandbox state change in progress".into(),
        ));
    }

    let toolbox_url = infra.toolbox_base_url();
    let response = SandboxDto::from_sandbox(&sandbox, None, None, &toolbox_url);
    infra.realtime.sandbox_desired_state_updated(
        sandbox.organization_id,
        &response,
        sandbox.desired_state,
        new_desired,
    );

    infra.task_tracker.spawn({
        let infra = infra.clone();
        async move {
            sandbox_actions::sync_instance_state(&infra, sandbox_id).await;
        }
    });

    Ok(())
}

pub async fn resize(
    infra: &Infra,
    sandbox_id: Uuid,
    cpu: i32,
    mem: i32,
    organization: &Organization,
) -> Result<()> {
    let sandbox = get_sandbox(&infra.pool, sandbox_id).await?;

    if !state_matches_desired(sandbox.state, sandbox.desired_state) {
        return Err(AppError::BadRequest("state change in progress".into()));
    }

    if sandbox.state != SandboxState::Started {
        return Err(AppError::BadRequest(
            "sandbox must be started to resize".into(),
        ));
    }

    if cpu > organization.max_cpu_per_sandbox {
        return Err(AppError::BadRequest(format!(
            "cpu {} exceeds max per sandbox ({})",
            cpu, organization.max_cpu_per_sandbox
        )));
    }

    if mem > organization.max_memory_per_sandbox {
        return Err(AppError::BadRequest(format!(
            "memory {} exceeds max per sandbox ({})",
            mem, organization.max_memory_per_sandbox
        )));
    }

    repositories::sandbox::update_resources(&infra.pool, sandbox_id, cpu, mem).await?;

    let rows = repositories::sandbox::update_desired_state_conditional(
        &infra.pool,
        sandbox_id,
        SandboxDesiredState::Resized,
        SandboxState::Started,
    )
    .await?;

    if rows == 0 {
        return Err(AppError::BadRequest(
            "sandbox state change in progress".into(),
        ));
    }

    let toolbox_url = infra.toolbox_base_url();
    let response = SandboxDto::from_sandbox(&sandbox, None, None, &toolbox_url);
    infra.realtime.sandbox_desired_state_updated(
        sandbox.organization_id,
        &response,
        sandbox.desired_state,
        SandboxDesiredState::Resized,
    );

    infra.task_tracker.spawn({
        let infra = infra.clone();
        async move {
            sandbox_actions::sync_instance_state(&infra, sandbox_id).await;
        }
    });

    Ok(())
}

pub async fn update_public_status(infra: &Infra, sandbox_id: Uuid, is_public: bool) -> Result<()> {
    let sandbox = get_sandbox(&infra.pool, sandbox_id).await?;

    repositories::sandbox::update_public(&infra.pool, sandbox_id, is_public).await?;

    let updated = Sandbox {
        public: is_public,
        ..sandbox
    };
    let toolbox_url = infra.toolbox_base_url();
    let response = SandboxDto::from_sandbox(&updated, None, None, &toolbox_url);
    infra
        .realtime
        .sandbox_public_status_updated(updated.organization_id, &response);

    Ok(())
}

pub async fn replace_labels(
    pool: &PgPool,
    sandbox_id: Uuid,
    labels: &serde_json::Value,
) -> Result<()> {
    get_sandbox(pool, sandbox_id).await?;

    repositories::sandbox::update_labels(pool, sandbox_id, labels).await?;
    Ok(())
}

pub async fn set_autostop_interval(pool: &PgPool, sandbox_id: Uuid, interval: i32) -> Result<()> {
    get_sandbox(pool, sandbox_id).await?;

    let resolved = resolve_auto_stop_interval(interval)?;
    repositories::sandbox::update_auto_stop_interval(pool, sandbox_id, resolved).await?;
    Ok(())
}

pub async fn set_auto_delete_interval(
    pool: &PgPool,
    sandbox_id: Uuid,
    interval: i32,
) -> Result<()> {
    get_sandbox(pool, sandbox_id).await?;

    repositories::sandbox::update_auto_delete_interval(pool, sandbox_id, interval).await?;
    Ok(())
}

pub async fn is_sandbox_public(pool: &PgPool, sandbox_id: Uuid) -> Result<bool> {
    let sandbox = get_sandbox(pool, sandbox_id).await?;

    Ok(sandbox.public)
}

pub async fn cleanup_destroyed(pool: &PgPool) {
    match repositories::sandbox::delete_destroyed_older_than(pool, 24).await {
        Ok(count) if count > 0 => {
            tracing::debug!(count, "cleaned up destroyed sandboxes");
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to cleanup destroyed sandboxes");
        }
        _ => {}
    }

    match repositories::sandbox::delete_build_failed_older_than(pool, 24).await {
        Ok(count) if count > 0 => {
            tracing::debug!(count, "cleaned up build-failed sandboxes");
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to cleanup build-failed sandboxes");
        }
        _ => {}
    }
}

pub async fn handle_unschedulable_executors(infra: &Infra) {
    let executors = match repositories::executor::find_all_unschedulable(&infra.pool).await {
        Ok(e) => e,
        Err(_) => return,
    };

    if executors.is_empty() {
        return;
    }

    let executor_ids: Vec<Uuid> = executors.iter().map(|e| e.id).collect();

    let sandboxes = match repositories::sandbox::find_warm_pool_by_executors(
        &infra.pool,
        &executor_ids,
    )
    .await
    {
        Ok(s) => s,
        Err(_) => return,
    };

    for sandbox in &sandboxes {
        if let Err(e) = destroy(infra, sandbox.id).await {
            tracing::error!(
                sandbox_id = %sandbox.id,
                error = %e,
                "failed to destroy sandbox on unschedulable executor"
            );
        }
    }
}

pub async fn handle_suspended_sandbox_stop(infra: &Infra, sandbox_id: Uuid) {
    if let Err(e) = stop(infra, sandbox_id).await {
        tracing::error!(
            sandbox_id = %sandbox_id,
            error = %e,
            "error stopping sandbox from suspended organization"
        );
    }
}

fn validated_region(region: Option<&str>) -> String {
    match region {
        Some(r) if !r.trim().is_empty() => r.trim().to_string(),
        _ => "us".to_string(),
    }
}

fn resolve_auto_stop_interval(interval: i32) -> Result<i32> {
    if interval < 0 {
        return Err(AppError::BadRequest(
            "auto-stop interval must be non-negative".into(),
        ));
    }
    Ok(interval)
}

pub fn state_matches_desired(state: SandboxState, desired: SandboxDesiredState) -> bool {
    matches!(
        (state, desired),
        (SandboxState::Started, SandboxDesiredState::Started)
            | (SandboxState::Started, SandboxDesiredState::Resized)
            | (SandboxState::Stopped, SandboxDesiredState::Stopped)
            | (SandboxState::Destroyed, SandboxDesiredState::Destroyed)
            | (SandboxState::Archived, SandboxDesiredState::Archived)
    )
}

fn generate_auth_token() -> String {
    let bytes: [u8; 32] = rand::rng().random();
    hex::encode(bytes)
}
