// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::types::{FindQuery, Match, validate_path};
use snapflow_errors::AppError;
use axum::{Json, extract::Query};
use std::io::Read;
use std::path::Path;

const MAX_DEPTH: usize = 20;
const MAX_RESULTS: usize = 1000;

const SKIP_DIRS: &[&str] = &[".git", "node_modules"];

#[utoipa::path(
    get,
    path = "/files/find",
    tag = "file-system",
    operation_id = "findInFiles",
    params(FindQuery),
    responses(
        (status = 200, body = Vec<Match>),
    )
)]
pub async fn find_in_files(Query(q): Query<FindQuery>) -> Result<Json<Vec<Match>>, AppError> {
    let raw = q
        .path
        .ok_or_else(|| AppError::bad_request("path and pattern are required"))?;
    let path = validate_path(&raw)?;
    let pattern = q
        .pattern
        .ok_or_else(|| AppError::bad_request("path and pattern are required"))?;

    let matches = tokio::task::spawn_blocking(move || {
        let mut matches = Vec::default();
        walk(&path, &pattern, &mut matches, 0);
        matches
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?;

    Ok(Json(matches))
}

fn walk(dir: &Path, pattern: &str, matches: &mut Vec<Match>, depth: usize) {
    if depth >= MAX_DEPTH || matches.len() >= MAX_RESULTS {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if matches.len() >= MAX_RESULTS {
            return;
        }

        let path = entry.path();

        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str())
                && SKIP_DIRS.contains(&name)
            {
                continue;
            }
            walk(&path, pattern, matches, depth + 1);
        } else if path.is_file() {
            if let Ok(mut f) = std::fs::File::open(&path) {
                let mut header = [0u8; 512];
                let n = f.read(&mut header).unwrap_or(0);
                if header[..n].contains(&0) {
                    continue;
                }
            }

            if let Ok(content) = std::fs::read_to_string(&path) {
                for (i, line) in content.lines().enumerate() {
                    if matches.len() >= MAX_RESULTS {
                        return;
                    }
                    if line.contains(pattern) {
                        matches.push(Match {
                            file: path.to_string_lossy().to_string(),
                            line: i + 1,
                            content: line.to_string(),
                        });
                    }
                }
            }
        }
    }
}
