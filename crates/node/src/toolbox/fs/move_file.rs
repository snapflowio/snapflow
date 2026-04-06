// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::{MoveQuery, validate_path};
use snapflow_errors::AppError;
use axum::{Json, extract::Query, http::StatusCode, response::IntoResponse};
use std::path::Path;

#[utoipa::path(
    post,
    path = "/files/move",
    tag = "file-system",
    operation_id = "moveFile",
    params(MoveQuery),
    responses(
        (status = 200),
    )
)]
pub async fn move_file(Query(q): Query<MoveQuery>) -> Result<impl IntoResponse, AppError> {
    let source = q
        .source
        .ok_or_else(|| AppError::bad_request("source and destination paths are required"))?;
    let dest = q
        .destination
        .ok_or_else(|| AppError::bad_request("source and destination paths are required"))?;

    let abs_src = validate_path(&source)?;
    let abs_dest = validate_path(&dest)?;

    let result = tokio::task::spawn_blocking(move || -> Result<Option<String>, AppError> {
        if abs_dest.exists() {
            return Err(AppError::conflict("destination already exists"));
        }

        if std::fs::rename(&abs_src, &abs_dest).is_err() {
            copy_recursive(&abs_src, &abs_dest)?;
            if let Err(e) = std::fs::remove_dir_all(&abs_src) {
                return Ok(Some(format!("failed to delete source: {e}")));
            }
        }

        Ok(None)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))??;

    if let Some(error_msg) = result {
        return Ok((
            StatusCode::OK,
            Json(serde_json::json!({
                "message": "file copied successfully but source could not be deleted",
                "error": error_msg
            })),
        )
            .into_response());
    }

    Ok(StatusCode::OK.into_response())
}

fn copy_recursive(src: &Path, dst: &Path) -> Result<(), AppError> {
    if src.is_dir() {
        std::fs::create_dir_all(dst).map_err(AppError::from)?;
        for entry in std::fs::read_dir(src).map_err(AppError::from)?.flatten() {
            let src_child = entry.path();
            let dst_child = dst.join(entry.file_name());
            copy_recursive(&src_child, &dst_child)?;
        }
    } else {
        std::fs::copy(src, dst).map_err(AppError::from)?;
    }
    Ok(())
}
