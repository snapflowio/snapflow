// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::os::unix::fs::PermissionsExt;

use super::types::{FolderQuery, validate_path};
use crate::common::errors::AppError;
use axum::{extract::Query, http::StatusCode, response::IntoResponse};

#[utoipa::path(
    post,
    path = "/files/folder",
    tag = "file-system",
    operation_id = "createFolder",
    params(FolderQuery),
    responses(
        (status = 201),
    )
)]
pub async fn create_folder(Query(q): Query<FolderQuery>) -> Result<impl IntoResponse, AppError> {
    let raw = q
        .path
        .ok_or_else(|| AppError::bad_request("path is required"))?;
    let path = validate_path(&raw)?;

    let perm = if let Some(mode_str) = q.mode {
        u32::from_str_radix(&mode_str, 8)
            .map_err(|_| AppError::bad_request("invalid mode format"))?
    } else {
        0o755
    };

    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        std::fs::create_dir_all(&path).map_err(AppError::from)?;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(perm))
            .map_err(AppError::from)?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))??;

    Ok(StatusCode::CREATED)
}
