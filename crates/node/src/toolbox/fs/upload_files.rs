// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::validate_path;
use snapflow_errors::AppError;
use axum::{Json, extract::Multipart, http::StatusCode, response::IntoResponse};
use std::collections::HashMap;
use std::path::Path;

#[utoipa::path(
    post,
    path = "/files/bulk-upload",
    tag = "file-system",
    operation_id = "bulkUploadFiles",
    request_body(content_type = "multipart/form-data"),
    responses(
        (status = 200),
    )
)]
pub async fn bulk_upload(mut multipart: Multipart) -> Result<impl IntoResponse, AppError> {
    let mut destinations: HashMap<String, String> = HashMap::default();
    let mut errors: Vec<String> = Vec::default();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();

        if name.ends_with(".path") {
            let idx = extract_index(&name);
            match field.text().await {
                Ok(text) => match validate_path(&text) {
                    Ok(validated) => {
                        destinations.insert(idx, validated.to_string_lossy().to_string());
                    }
                    Err(e) => {
                        errors.push(format!("path[{idx}]: {e}"));
                    }
                },
                Err(e) => {
                    let idx = extract_index(&name);
                    errors.push(format!("path[{idx}]: {e}"));
                }
            }
        } else if name.ends_with(".file") {
            let idx = extract_index(&name);
            if let Some(dest) = destinations.get(&idx) {
                if let Some(parent) = Path::new(dest).parent()
                    && let Err(e) = tokio::fs::create_dir_all(parent).await
                {
                    errors.push(format!("{dest}: mkdir: {e}"));
                    continue;
                }
                match field.bytes().await {
                    Ok(data) => {
                        if let Err(e) = tokio::fs::write(dest, &data).await {
                            errors.push(format!("{dest}: write: {e}"));
                        }
                    }
                    Err(e) => errors.push(format!("{dest}: read: {e}")),
                }
            } else {
                errors.push(format!("file[{idx}]: missing .path metadata"));
            }
        }
    }

    if !errors.is_empty() {
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "errors": errors })),
        )
            .into_response());
    }

    Ok(StatusCode::OK.into_response())
}

fn extract_index(field_name: &str) -> String {
    field_name
        .strip_prefix("files[")
        .unwrap_or(field_name)
        .trim_end_matches("].path")
        .trim_end_matches("].file")
        .to_string()
}
