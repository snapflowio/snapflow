// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::{PathQuery, validate_path};
use snapflow_errors::AppError;
use axum::{body::Body, extract::Query, http::header, response::IntoResponse};
use tokio_util::io::ReaderStream;

#[utoipa::path(
    get,
    path = "/files/download",
    tag = "file-system",
    operation_id = "downloadFile",
    params(PathQuery),
    responses(
        (status = 200, content_type = "application/octet-stream"),
    )
)]
pub async fn download_file(Query(q): Query<PathQuery>) -> Result<impl IntoResponse, AppError> {
    let raw = q
        .path
        .ok_or_else(|| AppError::bad_request("path is required"))?;

    let abs = validate_path(&raw)?;
    let meta = tokio::fs::metadata(&abs).await.map_err(AppError::from)?;

    if meta.is_dir() {
        return Err(AppError::bad_request("path must be a file"));
    }

    let filename = abs
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "download".to_string());

    let file = tokio::fs::File::open(&abs).await.map_err(AppError::from)?;
    let stream = ReaderStream::new(file);

    Ok((
        [
            (header::CONTENT_TYPE, "application/octet-stream".to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename={filename}"),
            ),
        ],
        Body::from_stream(stream),
    ))
}
