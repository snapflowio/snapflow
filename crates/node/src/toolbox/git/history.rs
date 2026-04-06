// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{
    helpers::git,
    types::{GitCommitInfo, PathQuery},
};
use snapflow_errors::AppError;
use axum::{Json, extract::Query};

#[utoipa::path(
    get,
    path = "/git/history",
    tag = "git",
    operation_id = "getGitHistory",
    params(PathQuery),
    responses(
        (status = 200, body = Vec<GitCommitInfo>),
    )
)]
pub async fn get_history(Query(q): Query<PathQuery>) -> Result<Json<Vec<GitCommitInfo>>, AppError> {
    let path = q
        .path
        .ok_or_else(|| AppError::bad_request("path is required"))?;

    let output = git(&path, &["log", "--format=%H%n%an%n%ae%n%s%n%aI%n---"]).await?;

    let mut commits = Vec::default();
    let mut lines = output.lines().peekable();

    while lines.peek().is_some() {
        let hash = lines.next().unwrap_or_default().to_string();
        let author = lines.next().unwrap_or_default().to_string();
        let email = lines.next().unwrap_or_default().to_string();
        let message = lines.next().unwrap_or_default().to_string();
        let timestamp = lines.next().unwrap_or_default().to_string();
        let _ = lines.next(); // consume separator

        if !hash.is_empty() {
            commits.push(GitCommitInfo {
                hash,
                author,
                email,
                message,
                timestamp,
            });
        }
    }

    Ok(Json(commits))
}
