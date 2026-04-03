// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::PgPool;

use crate::config::{AppConfig, DefaultOrganizationQuota};
use crate::constants::permissions;
use crate::constants::sandbox::{
    DEFAULT_IMAGE_CPU, DEFAULT_IMAGE_DISK, DEFAULT_IMAGE_MEMORY, DEFAULT_SANDBOX_GPU,
};
use crate::repositories;
use crate::services;
use snapflow_models::{ImageState, RegistryType, SystemRole};

pub async fn run(pool: &PgPool, config: &AppConfig) {
    if let Err(e) = initialize_admin_user(pool).await {
        tracing::error!(error = %e, "failed to initialize admin user");
    }

    if let Err(e) = initialize_transient_registry(pool, config).await {
        tracing::error!(error = %e, "failed to initialize transient registry");
    }

    if let Err(e) = initialize_internal_registry(pool, config).await {
        tracing::error!(error = %e, "failed to initialize internal registry");
    }

    if let Err(e) = initialize_default_executor(pool, config).await {
        tracing::error!(error = %e, "failed to initialize default executor");
    }

    if let Err(e) = initialize_default_image(pool, config).await {
        tracing::error!(error = %e, "failed to initialize default image");
    }
}

async fn initialize_admin_user(pool: &PgPool) -> anyhow::Result<()> {
    let existing = repositories::user::find_by_email(pool, "admin@snapflow.io").await?;
    if existing.is_some() {
        return Ok(());
    }

    let user =
        repositories::user::create(pool, "Admin", "admin@snapflow.io", SystemRole::Admin).await?;

    repositories::user::set_email_verified(pool, user.id, true).await?;

    let admin_quota = DefaultOrganizationQuota {
        total_cpu_quota: 500,
        total_memory_quota: 65536, // 64 GB in MB
        total_disk_quota: 2000,
        max_cpu_per_sandbox: 32,
        max_memory_per_sandbox: 65536, // 64 GB in MB
        max_disk_per_sandbox: 2000,
        image_quota: 100,
        max_image_size: 100,
        bucket_quota: 200,
    };

    let personal_org =
        repositories::organization::create_personal(pool, user.id, &admin_quota).await?;

    let all_permissions: Vec<String> = permissions::ALL.iter().map(|s| s.to_string()).collect();

    let api_key = services::api_key::create(
        pool,
        personal_org.id,
        user.id,
        "admin",
        &all_permissions,
        None,
    )
    .await?;

    tracing::info!("========================================");
    tracing::info!("Admin user created successfully!");
    tracing::info!("Email: admin@snapflow.io");
    tracing::info!("API Key: {}", api_key.value);
    tracing::info!("Organization: {}", personal_org.id);
    tracing::info!("========================================");

    Ok(())
}

async fn initialize_transient_registry(pool: &PgPool, config: &AppConfig) -> anyhow::Result<()> {
    let existing =
        repositories::registry::find_default_by_type(pool, RegistryType::Transient).await?;
    if existing.is_some() {
        return Ok(());
    }

    let reg = &config.transient_registry;
    if reg.url.is_empty()
        || reg.admin.is_empty()
        || reg.password.is_empty()
        || reg.project_id.is_empty()
    {
        tracing::warn!("registry configuration not found, skipping transient registry setup");
        return Ok(());
    }

    let url = reg
        .url
        .trim_start_matches("https://")
        .trim_start_matches("http://");

    tracing::info!("initializing default transient registry...");

    repositories::registry::create(
        pool,
        &repositories::registry::CreateRegistryParams {
            name: "Transient Registry",
            url,
            username: &reg.admin,
            password: &reg.password,
            project: &reg.project_id,
            registry_type: RegistryType::Transient,
            is_default: true,
            organization_id: None,
        },
    )
    .await?;

    tracing::info!("default transient registry initialized successfully");
    Ok(())
}

async fn initialize_internal_registry(pool: &PgPool, config: &AppConfig) -> anyhow::Result<()> {
    let existing =
        repositories::registry::find_default_by_type(pool, RegistryType::Internal).await?;
    if existing.is_some() {
        return Ok(());
    }

    let reg = &config.internal_registry;
    if reg.url.is_empty()
        || reg.admin.is_empty()
        || reg.password.is_empty()
        || reg.project_id.is_empty()
    {
        tracing::warn!("registry configuration not found, skipping internal registry setup");
        return Ok(());
    }

    let url = reg
        .url
        .trim_start_matches("https://")
        .trim_start_matches("http://");

    tracing::info!("initializing default internal registry...");

    repositories::registry::create(
        pool,
        &repositories::registry::CreateRegistryParams {
            name: "Internal Registry",
            url,
            username: &reg.admin,
            password: &reg.password,
            project: &reg.project_id,
            registry_type: RegistryType::Internal,
            is_default: true,
            organization_id: None,
        },
    )
    .await?;

    tracing::info!("default internal registry initialized successfully");
    Ok(())
}

async fn initialize_default_executor(pool: &PgPool, config: &AppConfig) -> anyhow::Result<()> {
    if config.is_production() {
        return Ok(());
    }

    let exec_cfg = &config.default_executor;
    if !exec_cfg.is_configured() {
        return Ok(());
    }

    let executors = repositories::executor::find_all(pool).await?;
    if executors.iter().any(|e| e.domain == exec_cfg.domain) {
        return Ok(());
    }

    tracing::info!("initializing default executor...");

    repositories::executor::create(
        pool,
        &repositories::executor::CreateExecutorParams {
            domain: &exec_cfg.domain,
            api_url: &exec_cfg.api_url,
            proxy_url: &exec_cfg.proxy_url,
            api_key: &exec_cfg.api_key,
            cpu: exec_cfg.cpu,
            memory_gib: exec_cfg.memory_gib,
            disk_gib: exec_cfg.disk_gib,
            gpu: exec_cfg.gpu,
            gpu_type: &exec_cfg.gpu_type,
            class: &exec_cfg.class,
            capacity: exec_cfg.capacity,
            region: &exec_cfg.region,
            version: &exec_cfg.version,
        },
    )
    .await?;

    tracing::info!("default executor initialized successfully");
    Ok(())
}

async fn initialize_default_image(pool: &PgPool, config: &AppConfig) -> anyhow::Result<()> {
    let Some(admin) = repositories::user::find_by_email(pool, "admin@snapflow.io").await? else {
        tracing::warn!("admin user not found, skipping default image initialization");
        return Ok(());
    };

    let Some(personal_org) = repositories::organization::find_personal(pool, admin.id).await?
    else {
        tracing::warn!("admin personal org not found, skipping default image initialization");
        return Ok(());
    };

    if personal_org.suspended {
        repositories::organization::unsuspend(pool, personal_org.id).await?;
    }

    let existing =
        repositories::image::find_by_name(pool, &config.default_image, personal_org.id).await?;
    if existing.is_some() {
        return Ok(());
    }

    let general_existing =
        repositories::image::find_general_by_name(pool, &config.default_image).await?;
    if general_existing.is_some() {
        return Ok(());
    }

    tracing::info!("default image not found, creating...");

    repositories::image::create(
        pool,
        &repositories::image::CreateImageParams {
            organization_id: Some(personal_org.id),
            name: &config.default_image,
            image_name: &config.default_image,
            general: true,
            state: ImageState::Pending,
            cpu: DEFAULT_IMAGE_CPU,
            gpu: DEFAULT_SANDBOX_GPU,
            mem: DEFAULT_IMAGE_MEMORY,
            disk: DEFAULT_IMAGE_DISK,
            entrypoint: None,
            cmd: None,
            build_info_image_ref: None,
        },
    )
    .await?;

    tracing::info!("default image created successfully");
    Ok(())
}
