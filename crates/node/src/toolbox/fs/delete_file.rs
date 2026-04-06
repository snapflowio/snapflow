// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::{DeleteQuery, validate_path};
use snapflow_errors::AppError;
use axum::{extract::Query, http::StatusCode, response::IntoResponse};

#[utoipa::path(
    delete,
    path = "/files",
    tag = "file-system",
    operation_id = "deleteFile",
    params(DeleteQuery),
    responses(
        (status = 204),
    )
)]
pub async fn delete_file(Query(q): Query<DeleteQuery>) -> Result<impl IntoResponse, AppError> {
    let raw = q
        .path
        .ok_or_else(|| AppError::bad_request("path is required"))?;
    let path = validate_path(&raw)?;
    let recursive = q.recursive.as_deref() == Some("true");

    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let meta = std::fs::metadata(&path).map_err(AppError::from)?;

        if meta.is_dir() && !recursive {
            return Err(AppError::bad_request(
                "cannot delete directory without recursive flag",
            ));
        }

        if recursive {
            std::fs::remove_dir_all(&path).map_err(AppError::from)?;
        } else {
            std::fs::remove_file(&path).map_err(AppError::from)?;
        }

        Ok(())
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))??;

    Ok(StatusCode::NO_CONTENT)
}
