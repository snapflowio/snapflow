// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::time::Duration;

use axum::Json;
use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{Response, StatusCode};
use serde::Deserialize;
use uuid::Uuid;

use crate::constants::permissions;
use crate::extractors::auth::AdminOrProxyAuth;
use crate::extractors::image::ImageAccess;
use crate::extractors::organization::{OrgResourceAccess, OrganizationResourceContext};
use crate::extractors::validated_json::ValidatedJson;
use crate::repositories;
use crate::schemas::sandbox::{
    CreateImageDto, ImageDto, PaginatedImagesDto, SetImageGeneralStatusDto,
};
use crate::services;
use crate::state::AppState;
use snapflow_errors::{AppError, Result};
use snapflow_models::SystemRole;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedImagesQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct CanCleanupQuery {
    #[serde(rename = "imageName")]
    pub image_name: String,
}

#[derive(Deserialize)]
pub struct BuildLogsQuery {
    #[serde(default)]
    pub follow: Option<bool>,
}

#[utoipa::path(
    post,
    path = "/images",
    tag = "images",
    operation_id = "createImage",
    summary = "Create a new image",
    request_body = CreateImageDto,
    responses(
        (status = 200, description = "Image created successfully.", body = ImageDto),
    ),
    security(("bearer" = []))
)]
pub async fn create(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateImageDto>,
) -> Result<Json<ImageDto>> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_IMAGES])
        .await?;

    let general = body.general.unwrap_or(false);
    if general && org_ctx.auth.role != SystemRole::Admin {
        return Err(AppError::Forbidden(
            "insufficient permissions for creating general images".into(),
        ));
    }

    if body.build_info.is_some() {
        if body.image_name.is_some() {
            return Err(AppError::BadRequest(
                "cannot specify an image name when using a build info entry".into(),
            ));
        }
        if body.entrypoint.is_some() {
            return Err(AppError::BadRequest(
                "cannot specify an entrypoint when using a build info entry".into(),
            ));
        }
    } else if body.image_name.is_none() {
        return Err(AppError::BadRequest(
            "must specify an image name when not using a build info entry".into(),
        ));
    }

    let image = services::image::create_image(
        &state.infra.pool,
        &org_ctx.organization,
        &body,
        general,
        &state.infra.realtime,
    )
    .await?;

    let build_info = match &image.build_info_image_ref {
        Some(r) => repositories::build_info::find_by_ref(&state.infra.pool, r).await?,
        None => None,
    };

    Ok(Json(ImageDto::from_image(&image, build_info.as_ref())))
}

#[utoipa::path(
    get,
    path = "/images/can-cleanup-image",
    tag = "images",
    operation_id = "canCleanupImage",
    summary = "Check if an image can be cleaned up",
    params(
        ("imageName" = String, Query, description = "Name of the image to check"),
    ),
    responses(
        (status = 200, description = "Whether the image can be cleaned up.", body = bool),
    ),
    security(("bearer" = []))
)]
pub async fn can_cleanup_image(
    _admin: AdminOrProxyAuth,
    State(state): State<AppState>,
    Query(query): Query<CanCleanupQuery>,
) -> Result<Json<bool>> {
    let result = services::image::can_cleanup_image(&state.infra.pool, &query.image_name).await?;
    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/images/{id}",
    tag = "images",
    operation_id = "getImage",
    summary = "Get image by ID or name",
    params(
        ("id" = String, Path, description = "ID or name of the image"),
    ),
    responses(
        (status = 200, description = "Image details.", body = ImageDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_by_id(
    access: ImageAccess,
    State(state): State<AppState>,
) -> Result<Json<ImageDto>> {
    let build_info = match &access.image.build_info_image_ref {
        Some(r) => repositories::build_info::find_by_ref(&state.infra.pool, r).await?,
        None => None,
    };

    Ok(Json(ImageDto::from_image(
        &access.image,
        build_info.as_ref(),
    )))
}

#[utoipa::path(
    delete,
    path = "/images/{id}",
    tag = "images",
    operation_id = "deleteImage",
    summary = "Delete an image",
    params(
        ("id" = String, Path, description = "ID of the image"),
    ),
    responses(
        (status = 200, description = "Image has been deleted."),
    ),
    security(("bearer" = []))
)]
pub async fn delete(access: ImageAccess, State(state): State<AppState>) -> Result<StatusCode> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::DELETE_IMAGES])
        .await?;

    services::image::remove_image(&state.infra.pool, access.image.id, &state.infra.realtime)
        .await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/images",
    tag = "images",
    operation_id = "listImages",
    summary = "List all images with pagination",
    params(
        ("page" = Option<i64>, Query, description = "Page number (default: 1)"),
        ("limit" = Option<i64>, Query, description = "Number of items per page (default: 10)"),
    ),
    responses(
        (status = 200, description = "Paginated list of images.", body = PaginatedImagesDto),
    ),
    security(("bearer" = []))
)]
pub async fn list(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    Query(query): Query<PaginatedImagesQuery>,
) -> Result<Json<PaginatedImagesDto>> {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(10);

    let result =
        services::image::get_all_images(&state.infra.pool, org_ctx.organization.id, page, limit)
            .await?;

    Ok(Json(result))
}

#[utoipa::path(
    patch,
    path = "/images/{id}/general",
    tag = "images",
    operation_id = "setImageGeneralStatus",
    summary = "Set image general status",
    params(
        ("id" = Uuid, Path, description = "ID of the image"),
    ),
    request_body = SetImageGeneralStatusDto,
    responses(
        (status = 200, description = "Image general status updated.", body = ImageDto),
    ),
    security(("bearer" = []))
)]
pub async fn set_general_status(
    _admin: AdminOrProxyAuth,
    State(state): State<AppState>,
    axum::extract::Path(image_id): axum::extract::Path<Uuid>,
    ValidatedJson(body): ValidatedJson<SetImageGeneralStatusDto>,
) -> Result<Json<ImageDto>> {
    let image =
        services::image::set_image_general_status(&state.infra.pool, image_id, body.general)
            .await?;

    let build_info = match &image.build_info_image_ref {
        Some(r) => repositories::build_info::find_by_ref(&state.infra.pool, r).await?,
        None => None,
    };

    Ok(Json(ImageDto::from_image(&image, build_info.as_ref())))
}

#[utoipa::path(
    get,
    path = "/images/{id}/build-logs",
    tag = "images",
    operation_id = "getImageBuildLogs",
    summary = "Get image build logs",
    params(
        ("id" = String, Path, description = "ID of the image"),
        ("follow" = Option<bool>, Query, description = "Whether to follow the logs stream"),
    ),
    responses(
        (status = 200, description = "Build logs stream."),
    ),
    security(("bearer" = []))
)]
pub async fn get_build_logs(
    access: ImageAccess,
    State(state): State<AppState>,
    Query(query): Query<BuildLogsQuery>,
) -> Result<Response<Body>> {
    let image_id = access.image.id;

    let build_info_ref = access
        .image
        .build_info_image_ref
        .as_deref()
        .ok_or(AppError::NotFound(format!(
            "image {image_id} has no build info"
        )))?;

    let build_executor_id = poll_for_build_executor(&state, image_id).await?;

    let executor = repositories::executor::find_by_id(&state.infra.pool, build_executor_id)
        .await?
        .ok_or(AppError::NotFound(format!(
            "build executor for image {image_id} not found"
        )))?;

    super::log_proxy::stream_build_logs(&executor, build_info_ref, query.follow.unwrap_or(false))
        .await
}

#[utoipa::path(
    post,
    path = "/images/{id}/activate",
    tag = "images",
    operation_id = "activateImage",
    summary = "Activate an image",
    params(
        ("id" = Uuid, Path, description = "ID of the image"),
    ),
    responses(
        (status = 200, description = "Image activated.", body = ImageDto),
    ),
    security(("bearer" = []))
)]
pub async fn activate(
    access: ImageAccess,
    State(state): State<AppState>,
) -> Result<Json<ImageDto>> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_IMAGES])
        .await?;

    let image =
        services::image::activate_image(&state.infra.pool, access.image.id, &state.infra.realtime)
            .await?;

    let build_info = match &image.build_info_image_ref {
        Some(r) => repositories::build_info::find_by_ref(&state.infra.pool, r).await?,
        None => None,
    };

    Ok(Json(ImageDto::from_image(&image, build_info.as_ref())))
}

#[utoipa::path(
    post,
    path = "/images/{id}/deactivate",
    tag = "images",
    operation_id = "deactivateImage",
    summary = "Deactivate an image",
    params(
        ("id" = Uuid, Path, description = "ID of the image"),
    ),
    responses(
        (status = 204, description = "Image deactivated."),
    ),
    security(("bearer" = []))
)]
pub async fn deactivate(access: ImageAccess, State(state): State<AppState>) -> Result<StatusCode> {
    access
        .org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_IMAGES])
        .await?;

    services::image::deactivate_image(&state.infra.pool, access.image.id, &state.infra.realtime)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn poll_for_build_executor(state: &AppState, image_id: Uuid) -> Result<Uuid> {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(30);

    loop {
        let image = services::image::get_image(&state.infra.pool, image_id).await?;

        if let Some(ref executor_id_str) = image.build_executor_id
            && let Ok(id) = Uuid::parse_str(executor_id_str)
        {
            return Ok(id);
        }

        if tokio::time::Instant::now() >= deadline {
            return Err(AppError::NotFound(format!(
                "timeout waiting for build executor assignment for image {image_id}"
            )));
        }

        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}
