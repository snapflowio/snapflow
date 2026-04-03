// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use serde::Deserialize;
use std::sync::Arc;
use tokio::io::AsyncBufReadExt;
use tracing::error;
use validator::Validate;

use crate::api::dto::image::{
    BuildImageRequestDTO, ImageExistsResponse, ImageInfoResponse, PullImageRequestDTO,
    TagImageRequestDTO,
};
use crate::api::errors::{AppError, ErrorResponse, docker_error_to_app_error};

use super::super::AppState;

#[utoipa::path(
    post,
    path = "/images/pull",
    operation_id = "PullImage",
    tags = ["images"],
    summary = "Pull an image",
    description = "Pull an image from a registry",
    request_body = PullImageRequestDTO,
    responses(
        (status = 200, description = "Image successfully pulled", body = String),
        (status = 400, body = ErrorResponse), (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse), (status = 409, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
pub async fn pull_image(
    State(state): State<Arc<AppState>>,
    Json(dto): Json<PullImageRequestDTO>,
) -> Result<Json<String>, AppError> {
    dto.validate()
        .map_err(|e| AppError::bad_request(format!("invalid request body: {}", e)))?;

    state
        .docker
        .pull_image(&dto.image, dto.registry.as_ref())
        .await
        .map_err(docker_error_to_app_error)?;

    Ok(Json("Image pulled successfully".to_string()))
}

#[utoipa::path(
    post,
    path = "/images/build",
    operation_id = "BuildImage",
    tags = ["images"],
    summary = "Build an image",
    description = "Build an image from a Dockerfile and context hashes",
    request_body = BuildImageRequestDTO,
    responses(
        (status = 200, description = "Image successfully built", body = String),
        (status = 400, body = ErrorResponse), (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse), (status = 409, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
pub async fn build_image(
    State(state): State<Arc<AppState>>,
    Json(dto): Json<BuildImageRequestDTO>,
) -> Result<Json<String>, AppError> {
    dto.validate()
        .map_err(|e| AppError::bad_request(format!("invalid request body: {}", e)))?;

    if !dto.image.contains(':') || dto.image.ends_with(':') {
        return Err(AppError::bad_request("image name must include a valid tag"));
    }

    state
        .docker
        .build_image(&dto, state.r2_client.as_ref())
        .await
        .map_err(docker_error_to_app_error)?;

    let tag = if dto.push_to_internal_registry.unwrap_or(false) {
        let registry = dto.registry.as_ref().ok_or_else(|| {
            AppError::bad_request("registry is required when pushing to internal registry")
        })?;
        let project = registry.project.as_ref().ok_or_else(|| {
            AppError::bad_request("project is required when pushing to internal registry")
        })?;
        format!("{}/{}/{}", registry.url, project, dto.image)
    } else {
        dto.image.clone()
    };

    state
        .docker
        .tag_image(&dto.image, &tag)
        .await
        .map_err(docker_error_to_app_error)?;

    if dto.push_to_internal_registry.unwrap_or(false) {
        let registry = dto.registry.as_ref().ok_or_else(|| {
            AppError::bad_request("registry is required when pushing to internal registry")
        })?;
        state
            .docker
            .push_image(&tag, Some(registry))
            .await
            .map_err(docker_error_to_app_error)?;
    }

    Ok(Json("Image built successfully".to_string()))
}

#[derive(Deserialize)]
pub struct ImageExistsQuery {
    pub image: Option<String>,
}

#[utoipa::path(
    get,
    path = "/images/exists",
    operation_id = "ImageExists",
    tags = ["images"],
    summary = "Check if an image exists",
    description = "Check if a specified image exists locally",
    params(("image" = String, Query, description = "Image name and tag")),
    responses(
        (status = 200, description = "OK", body = ImageExistsResponse),
        (status = 400, body = ErrorResponse), (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse), (status = 409, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
pub async fn image_exists(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ImageExistsQuery>,
) -> Result<Json<ImageExistsResponse>, AppError> {
    let image = query
        .image
        .ok_or_else(|| AppError::bad_request("image parameter is required"))?;

    let exists = state
        .docker
        .image_exists(&image, false)
        .await
        .map_err(docker_error_to_app_error)?;

    Ok(Json(ImageExistsResponse { exists }))
}

#[derive(Deserialize)]
pub struct RemoveImageQuery {
    pub image: Option<String>,
}

#[utoipa::path(
    post,
    path = "/images/remove",
    operation_id = "RemoveImage",
    tags = ["images"],
    summary = "Remove an image",
    description = "Remove a specified image from the local system",
    params(("image" = String, Query, description = "Image name and tag")),
    responses(
        (status = 200, description = "Image successfully removed", body = String),
        (status = 400, body = ErrorResponse), (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse), (status = 409, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
pub async fn remove_image(
    State(state): State<Arc<AppState>>,
    Query(query): Query<RemoveImageQuery>,
) -> Result<Json<String>, AppError> {
    let image = query
        .image
        .ok_or_else(|| AppError::bad_request("image parameter is required"))?;

    state
        .docker
        .remove_image(&image, true)
        .await
        .map_err(docker_error_to_app_error)?;

    Ok(Json("Image removed successfully".to_string()))
}

#[derive(Deserialize)]
pub struct BuildLogsQuery {
    #[serde(rename = "imageRef")]
    pub image_ref: Option<String>,
    pub follow: Option<String>,
}

#[utoipa::path(
    get,
    path = "/images/logs",
    operation_id = "GetBuildLogs",
    tags = ["images"],
    summary = "Get build logs",
    description = "Stream build logs",
    params(
        ("imageRef" = String, Query, description = "Image ID or image ref without the tag"),
        ("follow" = Option<bool>, Query, description = "Whether to follow the log output"),
    ),
    responses(
        (status = 200, description = "Build logs stream", body = String),
        (status = 400, body = ErrorResponse), (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
pub async fn get_build_logs(
    State(state): State<Arc<AppState>>,
    Query(query): Query<BuildLogsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let image_ref = query
        .image_ref
        .ok_or_else(|| AppError::bad_request("imageRef parameter is required"))?;

    let follow = query.follow.as_deref() == Some("true");

    let log_file_path = state
        .config
        .get_build_log_file_path(&image_ref)
        .map_err(|e| AppError::internal(e.to_string()))?;

    if !log_file_path.exists() {
        return Err(AppError::not_found(format!(
            "build logs not found for ref: {}",
            image_ref
        )));
    }

    let headers = [(axum::http::header::CONTENT_TYPE, "application/octet-stream")];

    if !follow {
        let content = tokio::fs::read(&log_file_path)
            .await
            .map_err(|e| AppError::internal(e.to_string()))?;
        return Ok((headers, content).into_response());
    }

    let docker = Arc::clone(&state.docker);
    let check_image_ref = if image_ref.starts_with("snapflow") {
        format!("{}:snapflow", image_ref)
    } else {
        image_ref.clone()
    };

    let stream = async_stream::stream! {
        let file = match tokio::fs::File::open(&log_file_path).await {
            Ok(f) => f,
            Err(e) => {
                error!(error = %e, "Error opening log file");
                return;
            }
        };

        let reader = tokio::io::BufReader::new(file);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            yield Ok::<_, std::io::Error>(axum::body::Bytes::from(format!("{}\n", line)));
        }

        loop {
            match docker.image_exists(&check_image_ref, false).await {
                Ok(true) => {
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    break;
                }
                Ok(false) => {
                    tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                }
                Err(e) => {
                    error!(error = %e, "Error checking build status");
                    break;
                }
            }
        }
    };

    let body = axum::body::Body::from_stream(stream);
    Ok((headers, body).into_response())
}

#[utoipa::path(
    post,
    path = "/images/tag",
    operation_id = "TagImage",
    tags = ["images"],
    summary = "Tag an image",
    description = "Tag an existing local image with a new target reference",
    request_body = TagImageRequestDTO,
    responses(
        (status = 200, description = "Image successfully tagged", body = String),
        (status = 400, body = ErrorResponse), (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse), (status = 409, body = ErrorResponse),
        (status = 500, body = ErrorResponse),
    )
)]
pub async fn tag_image(
    State(state): State<Arc<AppState>>,
    Json(dto): Json<TagImageRequestDTO>,
) -> Result<Json<String>, AppError> {
    dto.validate()
        .map_err(|e| AppError::bad_request(format!("invalid request body: {}", e)))?;

    // Check if source image exists
    let exists = state
        .docker
        .image_exists(&dto.source_image, false)
        .await
        .map_err(docker_error_to_app_error)?;

    if !exists {
        return Err(AppError::not_found(format!(
            "source image not found: {}",
            dto.source_image
        )));
    }

    // Validate target image has a tag
    if !dto.target_image.contains(':') || dto.target_image.ends_with(':') {
        return Err(AppError::bad_request(
            "targetImage must include a valid tag",
        ));
    }

    // Tag the image
    state
        .docker
        .tag_image(&dto.source_image, &dto.target_image)
        .await
        .map_err(docker_error_to_app_error)?;

    Ok(Json("Image tagged successfully".to_string()))
}

#[derive(Deserialize)]
pub struct ImageInfoQuery {
    pub image: Option<String>,
}

#[utoipa::path(
    get,
    path = "/images/info",
    operation_id = "GetImageInfo",
    tags = ["images"],
    summary = "Get image information",
    description = "Get information about a specified image including size and entrypoint",
    params(("image" = String, Query, description = "Image name and tag")),
    responses(
        (status = 200, description = "OK", body = ImageInfoResponse),
        (status = 400, body = ErrorResponse), (status = 401, body = ErrorResponse),
        (status = 404, body = ErrorResponse), (status = 500, body = ErrorResponse),
    )
)]
pub async fn get_image_info(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ImageInfoQuery>,
) -> Result<Json<ImageInfoResponse>, AppError> {
    let image = query
        .image
        .ok_or_else(|| AppError::bad_request("image parameter is required"))?;

    // Check if image exists
    let exists = state
        .docker
        .image_exists(&image, false)
        .await
        .map_err(docker_error_to_app_error)?;

    if !exists {
        return Err(AppError::not_found(format!("image not found: {}", image)));
    }

    // Get image info
    let info = state
        .docker
        .get_image_info(&image)
        .await
        .map_err(docker_error_to_app_error)?;

    // Remove sha256: prefix from hash
    let hash = info.hash.trim_start_matches("sha256:").to_string();

    Ok(Json(ImageInfoResponse {
        name: image,
        size_gb: info.size as f64 / (1024.0 * 1024.0 * 1024.0),
        entrypoint: info.entrypoint,
        cmd: info.cmd,
        hash,
    }))
}
