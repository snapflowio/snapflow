// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::{ReplaceRequest, ReplaceResult, validate_path};
use crate::common::errors::AppError;
use axum::Json;

#[utoipa::path(
    post,
    path = "/files/replace",
    tag = "file-system",
    operation_id = "replaceInFiles",
    request_body = ReplaceRequest,
    responses(
        (status = 200, body = Vec<ReplaceResult>),
    )
)]
pub async fn replace_in_files(
    Json(req): Json<ReplaceRequest>,
) -> Result<Json<Vec<ReplaceResult>>, AppError> {
    let results = tokio::task::spawn_blocking(move || {
        let new_value = req.new_value.unwrap_or_default();
        let mut results = Vec::with_capacity(req.files.len());

        for file_path in &req.files {
            let validated = match validate_path(file_path) {
                Ok(p) => p,
                Err(e) => {
                    results.push(ReplaceResult {
                        file: file_path.clone(),
                        success: false,
                        error: Some(e.message),
                    });
                    continue;
                }
            };

            match std::fs::read_to_string(&validated) {
                Ok(content) => {
                    let replaced = content.replace(&req.pattern, &new_value);
                    match std::fs::write(&validated, replaced) {
                        Ok(()) => results.push(ReplaceResult {
                            file: file_path.clone(),
                            success: true,
                            error: None,
                        }),
                        Err(e) => results.push(ReplaceResult {
                            file: file_path.clone(),
                            success: false,
                            error: Some(e.to_string()),
                        }),
                    }
                }
                Err(e) => results.push(ReplaceResult {
                    file: file_path.clone(),
                    success: false,
                    error: Some(e.to_string()),
                }),
            }
        }

        results
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?;

    Ok(Json(results))
}
