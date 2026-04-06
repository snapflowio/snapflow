// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::{PathQuery, validate_path};
use snapflow_errors::AppError;
use axum::{
    extract::{Multipart, Query},
    http::StatusCode,
    response::IntoResponse,
};

#[utoipa::path(
    post,
    path = "/files/upload",
    tag = "file-system",
    operation_id = "uploadFile",
    params(PathQuery),
    request_body(content_type = "multipart/form-data"),
    responses(
        (status = 200),
    )
)]
pub async fn upload_file(
    Query(q): Query<PathQuery>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let raw = q
        .path
        .ok_or_else(|| AppError::bad_request("path is required"))?;
    let path = validate_path(&raw)?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(AppError::from)?;
    }

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("file") {
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::bad_request(e.to_string()))?;
            tokio::fs::write(&path, &data)
                .await
                .map_err(AppError::from)?;
            return Ok(StatusCode::OK);
        }
    }

    Err(AppError::bad_request("file field is required"))
}
