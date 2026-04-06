// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::{FindQuery, SearchFilesResponse, validate_path};
use snapflow_errors::AppError;
use axum::{Json, extract::Query};
use std::path::Path;

const MAX_DEPTH: usize = 20;
const MAX_RESULTS: usize = 1000;

const SKIP_DIRS: &[&str] = &[".git", "node_modules"];

#[utoipa::path(
    get,
    path = "/files/search",
    tag = "file-system",
    operation_id = "searchFiles",
    params(FindQuery),
    responses(
        (status = 200, body = SearchFilesResponse),
    )
)]
pub async fn search_files(
    Query(q): Query<FindQuery>,
) -> Result<Json<SearchFilesResponse>, AppError> {
    let raw = q
        .path
        .ok_or_else(|| AppError::bad_request("path and pattern are required"))?;
    let path = validate_path(&raw)?;
    let pattern = q
        .pattern
        .ok_or_else(|| AppError::bad_request("path and pattern are required"))?;

    let files = tokio::task::spawn_blocking(move || {
        let mut files = Vec::default();
        walk(&path, &pattern, &mut files, 0);
        files
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?;

    Ok(Json(SearchFilesResponse { files }))
}

fn walk(dir: &Path, pattern: &str, files: &mut Vec<String>, depth: usize) {
    if depth >= MAX_DEPTH || files.len() >= MAX_RESULTS {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if files.len() >= MAX_RESULTS {
            return;
        }

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if glob::Pattern::new(pattern)
            .map(|p| p.matches(&name))
            .unwrap_or(false)
        {
            files.push(path.to_string_lossy().to_string());
        }

        if path.is_dir() {
            if let Some(dir_name) = path.file_name().and_then(|n| n.to_str())
                && SKIP_DIRS.contains(&dir_name)
            {
                continue;
            }
            walk(&path, pattern, files, depth + 1);
        }
    }
}
