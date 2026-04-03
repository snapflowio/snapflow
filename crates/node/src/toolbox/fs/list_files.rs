// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{
    get_file_info::get_file_info_impl,
    types::{FileInfo, PathQuery, validate_path},
};
use crate::common::errors::AppError;
use axum::{Json, extract::Query};

#[utoipa::path(
    get,
    path = "/files",
    tag = "file-system",
    operation_id = "listFiles",
    params(PathQuery),
    responses(
        (status = 200, body = Vec<FileInfo>),
    )
)]
pub async fn list_files(Query(q): Query<PathQuery>) -> Result<Json<Vec<FileInfo>>, AppError> {
    let raw = q.path.unwrap_or_else(|| ".".to_string());
    let path = validate_path(&raw)?;

    let infos = tokio::task::spawn_blocking(move || -> Result<Vec<FileInfo>, AppError> {
        let entries = std::fs::read_dir(&path).map_err(AppError::from)?;

        let mut infos = Vec::default();
        for entry in entries.flatten() {
            if let Ok(info) = get_file_info_impl(&entry.path()) {
                infos.push(info);
            }
        }

        Ok(infos)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))??;

    Ok(Json(infos))
}
