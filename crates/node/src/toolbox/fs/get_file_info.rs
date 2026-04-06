// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::{FileInfo, PathQuery, validate_path};
use snapflow_errors::AppError;
use axum::{Json, extract::Query};
use std::os::unix::fs::MetadataExt;
use std::path::Path;

fn format_mode(meta: &std::fs::Metadata) -> String {
    let mode = meta.mode();
    let file_type = if meta.is_dir() {
        'd'
    } else if meta.file_type().is_symlink() {
        'L'
    } else {
        '-'
    };
    let rwx = |bits: u32| -> String {
        let r = if bits & 4 != 0 { 'r' } else { '-' };
        let w = if bits & 2 != 0 { 'w' } else { '-' };
        let x = if bits & 1 != 0 { 'x' } else { '-' };
        format!("{r}{w}{x}")
    };
    format!(
        "{}{}{}{}",
        file_type,
        rwx((mode >> 6) & 7),
        rwx((mode >> 3) & 7),
        rwx(mode & 7),
    )
}

pub fn get_file_info_impl(path: &Path) -> Result<FileInfo, AppError> {
    let meta = std::fs::metadata(path).map_err(AppError::from)?;

    Ok(FileInfo {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        size: meta.len() as i64,
        mode: format_mode(&meta),
        mod_time: meta
            .modified()
            .ok()
            .and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| {
                    chrono::DateTime::from_timestamp(d.as_secs() as i64, d.subsec_nanos())
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default()
                })
            })
            .unwrap_or_default(),
        is_dir: meta.is_dir(),
        owner: meta.uid().to_string(),
        group: meta.gid().to_string(),
        permissions: format!("{:04o}", meta.mode() & 0o7777),
    })
}

#[utoipa::path(
    get,
    path = "/files/info",
    tag = "file-system",
    operation_id = "getFileInfo",
    params(PathQuery),
    responses(
        (status = 200, body = FileInfo),
    )
)]
pub async fn get_file_info(Query(q): Query<PathQuery>) -> Result<Json<FileInfo>, AppError> {
    let raw = q
        .path
        .ok_or_else(|| AppError::bad_request("path is required"))?;
    let path = validate_path(&raw)?;

    let info = tokio::task::spawn_blocking(move || get_file_info_impl(&path))
        .await
        .map_err(|e| AppError::internal(e.to_string()))??;

    Ok(Json(info))
}
