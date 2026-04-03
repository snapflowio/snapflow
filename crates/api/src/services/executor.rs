// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashSet;

use rand::Rng;
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::ExecutorUsageConfig;
use crate::constants::{lock_keys, lock_ttls};
use crate::executor::{self, ExecutorInfo};
use crate::infra::Infra;
use crate::models::{Executor, ImageExecutor};
use crate::repositories;
use crate::schemas::sandbox::{CreateExecutorDto, ExecutorImageDto};
use snapflow_errors::{AppError, Result};
use snapflow_models::{ExecutorState, ImageExecutorState, SandboxClass, SandboxState};

pub struct GetExecutorParams<'a> {
    pub region: Option<&'a str>,
    pub sandbox_class: Option<SandboxClass>,
    pub image_ref: Option<&'a str>,
    pub excluded_executor_ids: &'a [Uuid],
}

struct AvailabilityScoreParams {
    cpu_usage: f64,
    memory_usage: f64,
    disk_usage: f64,
    allocated_cpu: f64,
    allocated_memory_gib: f64,
    allocated_disk_gib: f64,
    executor_cpu: f64,
    executor_memory_gib: f64,
    executor_disk_gib: f64,
}

pub async fn create(pool: &PgPool, req: &CreateExecutorDto) -> Result<Executor> {
    if req.region.trim().is_empty() {
        return Err(AppError::BadRequest("invalid region".into()));
    }

    let executor = repositories::executor::create(
        pool,
        &repositories::executor::CreateExecutorParams {
            domain: &req.domain,
            api_url: &req.api_url,
            proxy_url: &req.proxy_url,
            api_key: &req.api_key,
            cpu: req.cpu,
            memory_gib: req.memory_gib,
            disk_gib: req.disk_gib,
            gpu: req.gpu,
            gpu_type: &req.gpu_type,
            class: serde_json::to_value(req.class)
                .as_ref()
                .ok()
                .and_then(|v| v.as_str())
                .unwrap_or("small"),
            capacity: req.capacity,
            region: &req.region,
            version: &req.version,
        },
    )
    .await?;

    Ok(executor)
}

pub async fn find_all(pool: &PgPool) -> Result<Vec<Executor>> {
    let executors = repositories::executor::find_all(pool).await?;
    Ok(executors)
}

pub async fn find_one(pool: &PgPool, id: Uuid) -> Result<Executor> {
    repositories::executor::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound(format!("executor {id} not found")))
}

pub async fn find_by_ids(pool: &PgPool, ids: &[Uuid]) -> Result<Vec<Executor>> {
    let executors = repositories::executor::find_by_ids(pool, ids).await?;
    Ok(executors)
}

pub async fn find_by_sandbox_id(pool: &PgPool, sandbox_id: Uuid) -> Result<Executor> {
    let sandbox = repositories::sandbox::find_by_id_active(pool, sandbox_id)
        .await?
        .ok_or(AppError::NotFound(format!(
            "sandbox {sandbox_id} not found"
        )))?;

    let executor_id = sandbox.executor_id.ok_or(AppError::NotFound(format!(
        "sandbox {sandbox_id} does not have an executor"
    )))?;

    repositories::executor::find_by_id(pool, executor_id)
        .await?
        .ok_or(AppError::NotFound(format!(
            "executor {executor_id} not found"
        )))
}

pub async fn find_available(
    pool: &PgPool,
    params: &GetExecutorParams<'_>,
) -> Result<Vec<Executor>> {
    let executors = repositories::executor::find_available(
        pool,
        params.region,
        params.sandbox_class,
        params.image_ref,
        params.excluded_executor_ids,
    )
    .await?;

    Ok(executors)
}

pub async fn get_random_available(
    pool: &PgPool,
    params: &GetExecutorParams<'_>,
) -> Result<Executor> {
    let mut available = find_available(pool, params).await?;

    if available.is_empty() {
        return Err(AppError::BadRequest("no available executors".into()));
    }

    available.sort_by(|a, b| {
        let score_a = executor_usage_score(a);
        let score_b = executor_usage_score(b);
        score_a
            .partial_cmp(&score_b)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let best_score = executor_usage_score(&available[0]);
    let threshold = best_score + 10.0;
    let top_count = available
        .iter()
        .take_while(|e| executor_usage_score(e) <= threshold)
        .count()
        .max(1);

    let idx = rand::rng().random_range(0..top_count);
    Ok(available.swap_remove(idx))
}

fn executor_usage_score(executor: &Executor) -> f32 {
    let cpu = executor.current_cpu_usage_percentage;
    let mem = executor.current_memory_usage_percentage;
    let disk = executor.current_disk_usage_percentage;
    cpu * 0.40 + mem * 0.35 + disk * 0.25
}

pub async fn remove(pool: &PgPool, id: Uuid) -> Result<()> {
    repositories::executor::delete(pool, id).await?;
    Ok(())
}

pub async fn update_scheduling_status(
    pool: &PgPool,
    id: Uuid,
    unschedulable: bool,
) -> Result<Executor> {
    repositories::executor::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound(format!("executor {id} not found")))?;

    let executor = repositories::executor::update_unschedulable(pool, id, unschedulable).await?;
    Ok(executor)
}

pub async fn recalculate_usage(pool: &PgPool, executor_id: Uuid) -> Result<()> {
    repositories::executor::find_by_id(pool, executor_id)
        .await?
        .ok_or(AppError::NotFound("executor not found".into()))?;

    let active = repositories::sandbox::count_active_by_executor(pool, executor_id).await?;
    repositories::executor::update_used(pool, executor_id, active as i32).await?;

    Ok(())
}

pub async fn handle_sandbox_state_update(
    pool: &PgPool,
    executor_id: Option<Uuid>,
    new_state: SandboxState,
) -> Result<()> {
    if !matches!(new_state, SandboxState::Destroyed | SandboxState::Creating) {
        return Ok(());
    }

    if let Some(executor_id) = executor_id {
        recalculate_usage(pool, executor_id).await?;
    }

    Ok(())
}

pub async fn health_check_all(infra: &Infra) {
    let lock = &infra.lock;

    let lock_key = lock_keys::executor::HEALTH_CHECK;
    let Ok(Some(lock_code)) = lock.lock(lock_key, lock_ttls::executor::HEALTH_CHECK).await else {
        return;
    };

    let executors = match repositories::executor::find_all_active(&infra.pool).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "failed to fetch executors for health check");
            if let Err(e) = lock.unlock(lock_key, &lock_code).await {
                tracing::warn!(error = %e, key = lock_key, "failed to release lock");
            }
            return;
        }
    };

    for exec in &executors {
        tracing::debug!(executor_id = %exec.id, "checking executor");

        let adapter = match executor::create_adapter(exec) {
            Ok(a) => a,
            Err(e) => {
                tracing::error!(executor_id = %exec.id, error = %e, "failed to create adapter");
                if let Err(e) =
                    update_executor_state(&infra.pool, exec.id, ExecutorState::Unresponsive).await
                {
                    tracing::warn!(executor_id = %exec.id, error = %e, "failed to update executor state to unresponsive");
                }
                continue;
            }
        };

        match tokio::time::timeout(std::time::Duration::from_secs(10), adapter.health_check()).await
        {
            Ok(Ok(())) => {}
            Ok(Err(e)) => {
                let msg = e.to_string();
                if msg.contains("ECONNREFUSED") || msg.contains("Connection refused") {
                    tracing::error!(executor_id = %exec.id, "executor not reachable");
                } else {
                    tracing::error!(executor_id = %exec.id, error = %e, "error checking executor");
                }
                if let Err(e) =
                    update_executor_state(&infra.pool, exec.id, ExecutorState::Unresponsive).await
                {
                    tracing::warn!(executor_id = %exec.id, error = %e, "failed to update executor state to unresponsive");
                }
                continue;
            }
            Err(_) => {
                tracing::error!(executor_id = %exec.id, "executor health check timed out");
                if let Err(e) =
                    update_executor_state(&infra.pool, exec.id, ExecutorState::Unresponsive).await
                {
                    tracing::warn!(executor_id = %exec.id, error = %e, "failed to update executor state to unresponsive");
                }
                continue;
            }
        }

        let executor_info =
            match tokio::time::timeout(std::time::Duration::from_secs(10), adapter.executor_info())
                .await
            {
                Ok(Ok(info)) => Some(info),
                Ok(Err(e)) => {
                    tracing::warn!(
                        executor_id = %exec.id,
                        error = %e,
                        "failed to get executor info"
                    );
                    None
                }
                Err(_) => {
                    tracing::warn!(executor_id = %exec.id, "executor info request timed out");
                    None
                }
            };

        if let Err(e) = update_executor_status(
            &infra.pool,
            exec.id,
            executor_info.as_ref(),
            &infra.config.executor_usage,
        )
        .await
        {
            tracing::warn!(executor_id = %exec.id, error = %e, "failed to update executor status");
        }
        if let Err(e) = recalculate_usage(&infra.pool, exec.id).await {
            tracing::warn!(executor_id = %exec.id, error = %e, "failed to recalculate executor usage");
        }
    }

    if let Err(e) = lock.unlock(lock_key, &lock_code).await {
        tracing::warn!(error = %e, key = lock_key, "failed to release health check lock");
    }
}

async fn update_executor_state(
    pool: &PgPool,
    executor_id: Uuid,
    new_state: ExecutorState,
) -> Result<()> {
    let Some(executor) = repositories::executor::find_by_id(pool, executor_id).await? else {
        tracing::error!(executor_id = %executor_id, "executor not found when updating state");
        return Ok(());
    };

    if executor.state == ExecutorState::Decommissioned {
        tracing::debug!(executor_id = %executor_id, "executor is decommissioned, not updating state");
        return Ok(());
    }

    repositories::executor::update_state(pool, executor_id, new_state).await?;
    Ok(())
}

async fn update_executor_status(
    pool: &PgPool,
    executor_id: Uuid,
    executor_info: Option<&ExecutorInfo>,
    usage_config: &ExecutorUsageConfig,
) -> Result<()> {
    let Some(executor) = repositories::executor::find_by_id(pool, executor_id).await? else {
        tracing::error!(executor_id = %executor_id, "executor not found when updating status");
        return Ok(());
    };

    if executor.state == ExecutorState::Decommissioned {
        tracing::debug!(executor_id = %executor_id, "executor is decommissioned, not updating status");
        return Ok(());
    }

    let metrics = executor_info.and_then(|info| info.metrics.as_ref());

    match metrics {
        Some(m) => {
            let cpu_usage = m.current_cpu_usage_percentage;
            let mem_usage = m.current_memory_usage_percentage;
            let disk_usage = m.current_disk_usage_percentage;
            let alloc_cpu = m.current_allocated_cpu;
            let alloc_mem = m.current_allocated_memory_gib;
            let alloc_disk = m.current_allocated_disk_gib;
            let image_count = m.current_image_count;

            let score = calculate_availability_score(
                usage_config,
                AvailabilityScoreParams {
                    cpu_usage,
                    memory_usage: mem_usage,
                    disk_usage,
                    allocated_cpu: alloc_cpu as f64,
                    allocated_memory_gib: alloc_mem as f64,
                    allocated_disk_gib: alloc_disk as f64,
                    executor_cpu: executor.cpu as f64,
                    executor_memory_gib: executor.memory_gib as f64,
                    executor_disk_gib: executor.disk_gib as f64,
                },
            );

            repositories::executor::update_status(
                pool,
                executor_id,
                &repositories::executor::UpdateStatusParams {
                    current_cpu_usage_percentage: cpu_usage as f32,
                    current_memory_usage_percentage: mem_usage as f32,
                    current_disk_usage_percentage: disk_usage as f32,
                    current_allocated_cpu: alloc_cpu,
                    current_allocated_memory_gib: alloc_mem,
                    current_allocated_disk_gib: alloc_disk,
                    current_image_count: image_count,
                    availability_score: score,
                    version: executor.version.clone(),
                },
            )
            .await?;
        }
        None => {
            tracing::warn!(executor_id = %executor_id, "executor didn't send health metrics");
            repositories::executor::update_state(pool, executor_id, ExecutorState::Ready).await?;
        }
    }

    Ok(())
}

pub async fn get_image_executor(
    pool: &PgPool,
    executor_id: Uuid,
    image_ref: &str,
) -> Result<Option<ImageExecutor>> {
    let ie = repositories::executor::find_image_executor(pool, executor_id, image_ref).await?;
    Ok(ie)
}

pub async fn get_image_executors(pool: &PgPool, image_ref: &str) -> Result<Vec<ImageExecutor>> {
    let ies = repositories::executor::find_image_executors_by_ref(pool, image_ref).await?;
    Ok(ies)
}

pub async fn create_image_executor(
    pool: &PgPool,
    executor_id: Uuid,
    image_ref: &str,
    state: ImageExecutorState,
    error_reason: Option<&str>,
) -> Result<ImageExecutor> {
    let ie = repositories::executor::create_image_executor(
        pool,
        executor_id,
        image_ref,
        state,
        error_reason,
    )
    .await?;
    Ok(ie)
}

pub async fn get_executors_with_multiple_images_building(
    pool: &PgPool,
    max_image_count: i64,
) -> Result<Vec<Uuid>> {
    let ids =
        repositories::sandbox::find_executors_with_multiple_images_building(pool, max_image_count)
            .await?;
    Ok(ids)
}

pub async fn get_executors_by_image_ref(
    pool: &PgPool,
    image_ref: &str,
) -> Result<Vec<ExecutorImageDto>> {
    let image_executors =
        repositories::executor::find_image_executors_by_ref_active(pool, image_ref).await?;

    let executor_ids: Vec<Uuid> = image_executors
        .iter()
        .map(|ie| ie.executor_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    let executors = repositories::executor::find_by_ids(pool, &executor_ids).await?;

    tracing::debug!(
        count = executors.len(),
        ids = ?executors.iter().map(|e| e.id).collect::<Vec<_>>(),
        "found executors for image ref"
    );

    let results = executors
        .iter()
        .filter_map(|exec| {
            let ie = image_executors
                .iter()
                .find(|ie| ie.executor_id == exec.id)?;
            Some(ExecutorImageDto {
                executor_image_id: ie.id,
                executor_id: exec.id.to_string(),
                executor_domain: exec.domain.clone(),
            })
        })
        .collect();

    Ok(results)
}

fn calculate_availability_score(
    config: &ExecutorUsageConfig,
    params: AvailabilityScoreParams,
) -> i32 {
    if params.cpu_usage < 0.0
        || params.memory_usage < 0.0
        || params.disk_usage < 0.0
        || params.allocated_cpu < 0.0
        || params.allocated_memory_gib < 0.0
        || params.allocated_disk_gib < 0.0
    {
        tracing::warn!("negative metric values detected, returning score 0");
        return 0;
    }

    let alloc_cpu_ratio = safe_ratio(params.allocated_cpu, params.executor_cpu);
    let alloc_mem_ratio = safe_ratio(params.allocated_memory_gib, params.executor_memory_gib);
    let alloc_disk_ratio = safe_ratio(params.allocated_disk_gib, params.executor_disk_gib);

    let current = [
        params.cpu_usage,
        params.memory_usage,
        params.disk_usage,
        alloc_cpu_ratio,
        alloc_mem_ratio,
        alloc_disk_ratio,
    ];

    let ideal = [0.0, 0.0, 0.0, 100.0, 100.0, 100.0];
    let anti_ideal = [100.0, 100.0, 100.0, 500.0, 500.0, 500.0];

    let weights = [
        config.cpu_usage_weight,
        config.memory_usage_weight,
        config.disk_usage_weight,
        config.allocated_cpu_weight,
        config.allocated_memory_weight,
        config.allocated_disk_weight,
    ];

    let mut dist_ideal = 0.0_f64;
    let mut dist_anti_ideal = 0.0_f64;

    for i in 0..current.len() {
        let norm_current = current[i] / 100.0;
        let norm_ideal = ideal[i] / 100.0;
        let norm_anti = anti_ideal[i] / 100.0;

        dist_ideal += weights[i] * (norm_current - norm_ideal).powi(2);
        dist_anti_ideal += weights[i] * (norm_current - norm_anti).powi(2);
    }

    dist_ideal = dist_ideal.sqrt();
    dist_anti_ideal = dist_anti_ideal.sqrt();

    let denominator = dist_ideal + dist_anti_ideal;
    if denominator == 0.0 {
        return 100;
    }

    let mut topsis_score = dist_anti_ideal / denominator;

    let mut penalty_multiplier = 1.0_f64;

    if params.cpu_usage >= config.cpu_penalty_threshold {
        penalty_multiplier *= (-config.cpu_penalty_exponent
            * (params.cpu_usage - config.cpu_penalty_threshold))
            .exp();
    }
    if params.memory_usage >= config.memory_penalty_threshold {
        penalty_multiplier *= (-config.memory_penalty_exponent
            * (params.memory_usage - config.memory_penalty_threshold))
            .exp();
    }
    if params.disk_usage >= config.disk_penalty_threshold {
        penalty_multiplier *= (-config.disk_penalty_exponent
            * (params.disk_usage - config.disk_penalty_threshold))
            .exp();
    }

    topsis_score *= penalty_multiplier;

    (topsis_score * 100.0).round().max(0.0) as i32
}

fn safe_ratio(allocated: f64, total: f64) -> f64 {
    if total > 0.0 {
        (allocated / total) * 100.0
    } else {
        0.0
    }
}
