// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::time::Duration;

use axum::Json;
use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{Response, StatusCode};
use serde::Deserialize;
use uuid::Uuid;

use crate::constants::permissions;
use crate::extractors::organization::{OrgResourceAccess, OrganizationResourceContext};
use crate::extractors::sandbox::SandboxAccess;
use crate::extractors::validated_json::ValidatedJson;
use crate::repositories;
use crate::schemas::sandbox::{
    CreateSandboxDto, PaginatedSandboxesDto, PortPreviewUrlDto, ResizeSandboxDto, SandboxDto,
    UpdateSandboxLabelsDto,
};
use crate::services;
use crate::state::AppState;
use snapflow_errors::{AppError, Result};
use snapflow_models::SandboxState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSandboxesQuery {
    #[serde(default)]
    pub verbose: Option<bool>,
    pub labels: Option<String>,
    #[serde(default)]
    pub include_errored_deleted: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedSandboxesQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub labels: Option<String>,
    #[serde(default)]
    pub include_errored_deleted: Option<bool>,
}

#[derive(Deserialize)]
pub struct BuildLogsQuery {
    #[serde(default)]
    pub follow: Option<bool>,
}

fn parse_labels(raw: Option<&str>) -> Option<serde_json::Value> {
    raw.and_then(|s| serde_json::from_str(s).ok())
}

async fn resolve_executor_domains(
    pool: &sqlx::PgPool,
    sandboxes: &[crate::models::Sandbox],
) -> HashMap<Uuid, String> {
    let executor_ids: Vec<Uuid> = sandboxes
        .iter()
        .filter_map(|s| s.executor_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    let executors = match services::executor::find_by_ids(pool, &executor_ids).await {
        Ok(e) => e,
        Err(e) => {
            tracing::warn!(error = %e, "failed to resolve executor domains");
            return HashMap::default();
        }
    };

    executors.into_iter().map(|e| (e.id, e.domain)).collect()
}

#[utoipa::path(
    get,
    path = "/sandbox",
    tag = "sandbox",
    operation_id = "listSandboxes",
    summary = "List all sandboxes",
    params(
        ("verbose" = Option<bool>, Query, description = "Include verbose output"),
        ("labels" = Option<String>, Query, description = "JSON encoded labels to filter by"),
        ("includeErroredDeleted" = Option<bool>, Query, description = "Include errored and deleted sandboxes"),
    ),
    responses(
        (status = 200, description = "List of all sandboxes.", body = Vec<SandboxDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    Query(query): Query<ListSandboxesQuery>,
) -> Result<Json<Vec<SandboxDto>>> {
    let labels = parse_labels(query.labels.as_deref());
    let sandboxes =
        services::sandbox::find_all(&state.infra.pool, org_ctx.organization.id, labels.as_ref())
            .await?;

    let domain_map = resolve_executor_domains(&state.infra.pool, &sandboxes).await;

    let toolbox_url = state.infra.toolbox_base_url();
    let items = sandboxes
        .iter()
        .map(|s| {
            let domain = s.executor_id.and_then(|eid| domain_map.get(&eid).cloned());
            SandboxDto::from_sandbox(s, domain, None, &toolbox_url)
        })
        .collect();

    Ok(Json(items))
}

#[utoipa::path(
    get,
    path = "/sandbox/paginated",
    tag = "sandbox",
    operation_id = "listSandboxesPaginated",
    summary = "List all sandboxes with pagination",
    params(
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("limit" = Option<i64>, Query, description = "Number of items per page (default: 10)"),
        ("labels" = Option<String>, Query, description = "JSON encoded labels to filter by"),
        ("includeErroredDeleted" = Option<bool>, Query, description = "Include errored and deleted sandboxes"),
    ),
    responses(
        (status = 200, description = "Paginated list of sandboxes.", body = PaginatedSandboxesDto),
    ),
    security(("bearer" = []))
)]
pub async fn list_paginated(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    Query(query): Query<PaginatedSandboxesQuery>,
) -> Result<Json<PaginatedSandboxesDto>> {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(10);
    let labels = parse_labels(query.labels.as_deref());

    let result = services::sandbox::find_all_paginated(
        &state.infra,
        org_ctx.organization.id,
        page,
        limit,
        labels.as_ref(),
    )
    .await?;

    Ok(Json(result))
}

#[utoipa::path(
    post,
    path = "/sandbox",
    tag = "sandbox",
    operation_id = "createSandbox",
    summary = "Create a new sandbox",
    request_body = CreateSandboxDto,
    responses(
        (status = 200, description = "The sandbox has been successfully created.", body = SandboxDto),
    ),
    security(("bearer" = []))
)]
pub async fn create(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateSandboxDto>,
) -> Result<Json<SandboxDto>> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    if body.build_info.is_some() {
        if body.image.is_some() {
            return Err(AppError::BadRequest(
                "cannot specify an image when using build info".into(),
            ));
        }
        let sandbox =
            services::sandbox::create_from_build_info(&state.infra, &org_ctx.organization, &body)
                .await?;
        return Ok(Json(sandbox));
    }

    if body.cpu.is_some() || body.gpu.is_some() || body.memory.is_some() || body.disk.is_some() {
        return Err(AppError::BadRequest(
            "cannot specify sandbox resources when using an image".into(),
        ));
    }

    let mut sandbox =
        services::sandbox::create_from_image(&state.infra, &org_ctx.organization, &body).await?;

    if sandbox.state == Some(SandboxState::Started) {
        return Ok(Json(sandbox));
    }

    if let Some(started) = wait_for_sandbox_started(&state, sandbox.id, 30).await {
        sandbox = started;
    }

    Ok(Json(sandbox))
}

#[utoipa::path(
    get,
    path = "/sandbox/{sandboxId}",
    tag = "sandbox",
    operation_id = "getSandbox",
    summary = "Get sandbox details",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "Sandbox details.", body = SandboxDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_by_id(
    access: SandboxAccess,
    State(state): State<AppState>,
) -> Result<Json<SandboxDto>> {
    let domain = if let Some(eid) = access.sandbox.executor_id {
        repositories::executor::find_by_id(&state.infra.pool, eid)
            .await?
            .map(|e| e.domain)
    } else {
        None
    };

    let toolbox_url = state.infra.toolbox_base_url();
    Ok(Json(SandboxDto::from_sandbox(
        &access.sandbox,
        domain,
        None,
        &toolbox_url,
    )))
}

#[utoipa::path(
    delete,
    path = "/sandbox/{sandboxId}", 
    tag = "sandbox",
    operation_id = "deleteSandbox",
    summary = "Delete sandbox",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "Sandbox has been deleted."),
    ),
    security(("bearer" = []))
)]
pub async fn delete(access: SandboxAccess, State(state): State<AppState>) -> Result<StatusCode> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::DELETE_SANDBOXES])
        .await?;

    services::sandbox::destroy(&state.infra, access.sandbox.id).await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/sandbox/{sandboxId}/start",
    tag = "sandbox",
    operation_id = "startSandbox",
    summary = "Start sandbox",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "Sandbox has been started.", body = SandboxDto),
    ),
    security(("bearer" = []))
)]
pub async fn start(
    access: SandboxAccess,
    State(state): State<AppState>,
) -> Result<Json<SandboxDto>> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    let org = &access.org_ctx.organization;
    let sandbox_id = access.sandbox.id;

    services::sandbox::start(&state.infra, sandbox_id, org).await?;

    let toolbox_url = state.infra.toolbox_base_url();
    let mut sandbox = {
        let s = services::sandbox::get_sandbox(&state.infra.pool, sandbox_id).await?;
        SandboxDto::from_sandbox(&s, None, None, &toolbox_url)
    };

    if sandbox.state != Some(SandboxState::Started)
        && let Some(started) = wait_for_sandbox_started(&state, sandbox_id, 30).await
    {
        sandbox = started;
    }

    if sandbox.executor_domain.is_none() {
        let executor =
            services::executor::find_by_sandbox_id(&state.infra.pool, sandbox_id).await?;
        sandbox.executor_domain = Some(executor.domain);
    }

    Ok(Json(sandbox))
}

#[utoipa::path(
    post,
    path = "/sandbox/{sandboxId}/stop",
    tag = "sandbox",
    operation_id = "stopSandbox",
    summary = "Stop sandbox",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "Sandbox has been stopped."),
    ),
    security(("bearer" = []))
)]
pub async fn stop(access: SandboxAccess, State(state): State<AppState>) -> Result<StatusCode> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    services::sandbox::stop(&state.infra, access.sandbox.id).await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/sandbox/{sandboxId}/resize",
    tag = "sandbox",
    operation_id = "resizeSandbox",
    summary = "Resize sandbox",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    request_body = ResizeSandboxDto,
    responses(
        (status = 200, description = "Sandbox is being resized."),
    ),
    security(("bearer" = []))
)]
pub async fn resize(
    access: SandboxAccess,
    State(state): State<AppState>,
    ValidatedJson(dto): ValidatedJson<ResizeSandboxDto>,
) -> Result<StatusCode> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    let org = &access.org_ctx.organization;

    services::sandbox::resize(&state.infra, access.sandbox.id, dto.cpu, dto.mem, org).await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/sandbox/{sandboxId}/archive",
    tag = "sandbox",
    operation_id = "archiveSandbox",
    summary = "Archive sandbox",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "Sandbox has been archived."),
    ),
    security(("bearer" = []))
)]
pub async fn archive(access: SandboxAccess, State(state): State<AppState>) -> Result<StatusCode> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    services::sandbox::archive(&state.infra, access.sandbox.id).await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/sandbox/{sandboxId}/backup",
    tag = "sandbox",
    operation_id = "createBackup",
    summary = "Create a backup of a sandbox",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "Backup has been initiated."),
    ),
    security(("bearer" = []))
)]
pub async fn create_backup(
    access: SandboxAccess,
    State(state): State<AppState>,
) -> Result<StatusCode> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    services::sandbox::create_backup(&state.infra.pool, access.sandbox.id).await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    put,
    path = "/sandbox/{sandboxId}/labels",
    tag = "sandbox",
    operation_id = "replaceLabels",
    summary = "Replace sandbox labels",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    request_body = UpdateSandboxLabelsDto,
    responses(
        (status = 200, description = "Labels have been successfully replaced.", body = UpdateSandboxLabelsDto),
    ),
    security(("bearer" = []))
)]
pub async fn replace_labels(
    access: SandboxAccess,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<UpdateSandboxLabelsDto>,
) -> Result<Json<UpdateSandboxLabelsDto>> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    let labels_value = serde_json::to_value(&body.labels)
        .map_err(|e| AppError::Internal(format!("failed to serialize labels: {e}")))?;
    services::sandbox::replace_labels(&state.infra.pool, access.sandbox.id, &labels_value).await?;

    Ok(Json(body))
}

#[utoipa::path(
    post,
    path = "/sandbox/{sandboxId}/public/{isPublic}",
    tag = "sandbox",
    operation_id = "updatePublicStatus",
    summary = "Update public status",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
        ("isPublic" = bool, Path, description = "Public status to set"),
    ),
    responses(
        (status = 200, description = "Public status updated."),
    ),
    security(("bearer" = []))
)]
pub async fn update_public_status(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    axum::extract::Path((sandbox_id, is_public)): axum::extract::Path<(Uuid, bool)>,
) -> Result<StatusCode> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    services::sandbox::update_public_status(&state.infra, sandbox_id, is_public).await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/sandbox/{sandboxId}/autostop/{interval}",
    tag = "sandbox",
    operation_id = "setAutostopInterval",
    summary = "Set sandbox auto-stop interval",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
        ("interval" = i32, Path, description = "Auto-stop interval in minutes (0 to disable)"),
    ),
    responses(
        (status = 200, description = "Auto-stop interval has been set."),
    ),
    security(("bearer" = []))
)]
pub async fn set_autostop_interval(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    axum::extract::Path((sandbox_id, interval)): axum::extract::Path<(Uuid, i32)>,
) -> Result<StatusCode> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    services::sandbox::set_autostop_interval(&state.infra.pool, sandbox_id, interval).await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/sandbox/{sandboxId}/autodelete/{interval}",
    tag = "sandbox",
    operation_id = "setAutoDeleteInterval",
    summary = "Set sandbox auto-delete interval",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
        ("interval" = i32, Path, description = "Auto-delete interval in minutes"),
    ),
    responses(
        (status = 200, description = "Auto-delete interval has been set."),
    ),
    security(("bearer" = []))
)]
pub async fn set_auto_delete_interval(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    axum::extract::Path((sandbox_id, interval)): axum::extract::Path<(Uuid, i32)>,
) -> Result<StatusCode> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_SANDBOXES])
        .await?;

    services::sandbox::set_auto_delete_interval(&state.infra.pool, sandbox_id, interval).await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/sandbox/{sandboxId}/ports/{port}/preview-url",
    tag = "sandbox",
    operation_id = "getPortPreviewUrl",
    summary = "Get preview URL for a sandbox port",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
        ("port" = u16, Path, description = "Port number"),
    ),
    responses(
        (status = 200, description = "Preview URL for the specified port.", body = PortPreviewUrlDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_port_preview_url(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    axum::extract::Path((sandbox_id, port)): axum::extract::Path<(Uuid, u16)>,
) -> Result<Json<PortPreviewUrlDto>> {
    let sandbox = repositories::sandbox::find_by_id(&state.infra.pool, sandbox_id)
        .await?
        .ok_or(AppError::NotFound(format!(
            "sandbox {sandbox_id} not found"
        )))?;

    if sandbox.organization_id != org_ctx.organization.id {
        return Err(AppError::Forbidden(
            "sandbox does not belong to this organization".into(),
        ));
    }

    let proxy_domain = &state.infra.config.proxy.domain;
    let proxy_protocol = &state.infra.config.proxy.protocol;

    if !proxy_domain.is_empty() && !proxy_protocol.is_empty() && sandbox.node_version.is_some() {
        let executor_domain = if let Some(eid) = sandbox.executor_id {
            repositories::executor::find_by_id(&state.infra.pool, eid)
                .await?
                .map(|e| e.domain)
        } else {
            None
        };

        return Ok(Json(PortPreviewUrlDto {
            url: format!("{proxy_protocol}://{port}-{}.{proxy_domain}", sandbox.id),
            legacy_proxy_url: executor_domain.map(|d| format!("https://{port}-{}.{d}", sandbox.id)),
            token: sandbox.auth_token.clone(),
        }));
    }

    let result =
        services::sandbox::get_port_preview_url(&state.infra.pool, sandbox_id, port).await?;

    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/sandbox/{sandboxId}/build-logs",
    tag = "sandbox",
    operation_id = "getBuildLogs",
    summary = "Get build logs",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
        ("follow" = Option<bool>, Query, description = "Whether to follow the logs stream"),
    ),
    responses(
        (status = 200, description = "Build logs stream."),
    ),
    security(("bearer" = []))
)]
pub async fn get_build_logs(
    access: SandboxAccess,
    State(state): State<AppState>,
    Query(query): Query<BuildLogsQuery>,
) -> Result<Response<Body>> {
    let sandbox = &access.sandbox;

    let Some(executor_id) = sandbox.executor_id else {
        return Err(AppError::NotFound(format!(
            "sandbox {} has no executor assigned",
            sandbox.id
        )));
    };

    let Some(ref build_info_ref) = sandbox.build_info_image_ref else {
        return Err(AppError::NotFound(format!(
            "sandbox {} has no build info",
            sandbox.id
        )));
    };

    let executor = repositories::executor::find_by_id(&state.infra.pool, executor_id)
        .await?
        .ok_or(AppError::NotFound(format!(
            "executor not found for sandbox {}",
            sandbox.id
        )))?;

    let image_ref = build_info_ref.split(':').next().unwrap_or(build_info_ref);

    super::log_proxy::stream_build_logs(&executor, image_ref, query.follow.unwrap_or(false)).await
}

async fn wait_for_sandbox_started(
    state: &AppState,
    sandbox_id: Uuid,
    timeout_secs: u64,
) -> Option<SandboxDto> {
    let current = services::sandbox::get_sandbox(&state.infra.pool, sandbox_id)
        .await
        .ok()?;
    match current.state {
        SandboxState::Started => {
            return Some(build_sandbox_response(state, &current).await);
        }
        SandboxState::Error | SandboxState::BuildFailed => return None,
        _ => {}
    }

    let mut guard = state.infra.events.watch_sandbox(sandbox_id, current.state);
    let timeout = Duration::from_secs(timeout_secs);

    let result = tokio::time::timeout(timeout, async {
        loop {
            if guard.rx.changed().await.is_err() {
                return None;
            }
            let current_state = *guard.rx.borrow_and_update();
            match current_state {
                SandboxState::Started => return Some(()),
                SandboxState::Error | SandboxState::BuildFailed => return None,
                _ => continue,
            }
        }
    })
    .await;

    drop(guard);

    if !matches!(result, Ok(Some(()))) {
        return None;
    }

    let sandbox = services::sandbox::get_sandbox(&state.infra.pool, sandbox_id)
        .await
        .ok()?;
    Some(build_sandbox_response(state, &sandbox).await)
}

#[utoipa::path(
    post,
    path = "/sandbox/{sandboxId}/activity",
    tag = "sandbox",
    operation_id = "updateLastActivity",
    summary = "Update sandbox last activity timestamp",
    params(
        ("sandboxId" = Uuid, Path, description = "ID of the sandbox"),
    ),
    responses(
        (status = 200, description = "Last activity timestamp has been updated."),
    ),
    security(("bearer" = []))
)]
pub async fn update_last_activity(
    State(state): State<AppState>,
    axum::extract::Path(sandbox_id): axum::extract::Path<Uuid>,
) -> Result<StatusCode> {
    repositories::sandbox::update_last_activity(&state.infra.pool, sandbox_id).await?;
    Ok(StatusCode::OK)
}

async fn build_sandbox_response(state: &AppState, sandbox: &crate::models::Sandbox) -> SandboxDto {
    let domain = if let Some(eid) = sandbox.executor_id {
        repositories::executor::find_by_id(&state.infra.pool, eid)
            .await
            .ok()
            .flatten()
            .map(|e| e.domain)
    } else {
        None
    };
    let toolbox_url = state.infra.toolbox_base_url();
    SandboxDto::from_sandbox(sandbox, domain, None, &toolbox_url)
}
