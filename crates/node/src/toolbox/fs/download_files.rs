// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::validate_path;
use crate::common::errors::AppError;
use axum::{Json, body::Body, http::header, response::IntoResponse};
use serde::Deserialize;
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct BulkDownloadRequest {
    pub paths: Vec<String>,
}

#[utoipa::path(
    post,
    path = "/files/bulk-download",
    tag = "file-system",
    operation_id = "downloadFiles",
    request_body = BulkDownloadRequest,
    responses(
        (status = 200, content_type = "application/x-tar"),
    )
)]
pub async fn bulk_download(
    Json(req): Json<BulkDownloadRequest>,
) -> Result<impl IntoResponse, AppError> {
    if req.paths.is_empty() {
        return Err(AppError::bad_request("paths must be non-empty"));
    }

    let buf = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, AppError> {
        let mut archive_buf = Vec::default();
        {
            let mut builder = tar::Builder::new(&mut archive_buf);
            for raw_path in &req.paths {
                let abs = validate_path(raw_path)?;
                let meta = std::fs::metadata(&abs).map_err(AppError::from)?;
                if meta.is_dir() {
                    continue;
                }
                let archive_name = abs.to_string_lossy().trim_start_matches('/').to_string();
                let mut header = tar::Header::new_gnu();
                header.set_size(meta.len());
                header.set_mode(0o644);
                header.set_cksum();
                let file = std::fs::File::open(&abs).map_err(AppError::from)?;
                builder
                    .append_data(&mut header, &archive_name, file)
                    .map_err(|e| AppError::internal(e.to_string()))?;
            }
            builder
                .finish()
                .map_err(|e| AppError::internal(e.to_string()))?;
        }
        Ok(archive_buf)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))??;

    Ok((
        [
            (header::CONTENT_TYPE, "application/x-tar"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=download.tar",
            ),
        ],
        Body::from(buf),
    ))
}
