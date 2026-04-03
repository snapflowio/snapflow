// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{
    helpers::{git, map_status_char},
    types::{FileStatus, GitStatus, PathQuery},
};
use crate::common::errors::AppError;
use axum::{Json, extract::Query};

#[utoipa::path(
    get,
    path = "/git/status",
    tag = "git",
    operation_id = "getGitStatus",
    params(PathQuery),
    responses(
        (status = 200, body = GitStatus),
    )
)]
pub async fn get_status(Query(q): Query<PathQuery>) -> Result<Json<GitStatus>, AppError> {
    let path = q
        .path
        .ok_or_else(|| AppError::bad_request("path is required"))?;

    let branch = git(&path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .await
        .unwrap_or_else(|_| "HEAD".to_string());

    let status_output = git(&path, &["status", "--porcelain"])
        .await
        .unwrap_or_default();
    let files: Vec<FileStatus> = status_output
        .lines()
        .filter(|l| l.len() >= 3)
        .filter_map(|line| {
            let bytes = line.as_bytes();
            let staging = map_status_char(*bytes.first()? as char);
            let worktree = map_status_char(*bytes.get(1)? as char);
            let name = line.get(3..)?.to_string();
            Some(FileStatus {
                name,
                extra: String::default(),
                staging: staging.to_string(),
                worktree: worktree.to_string(),
            })
        })
        .collect();

    let upstream = git(
        &path,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ],
    )
    .await
    .unwrap_or_default();
    let branch_published = !upstream.is_empty();

    let (ahead, behind) = if branch_published {
        let ab_output = git(
            &path,
            &[
                "rev-list",
                "--left-right",
                "--count",
                &format!("{upstream}...HEAD"),
            ],
        )
        .await
        .unwrap_or_default();

        let parts: Vec<&str> = ab_output.split('\t').collect();
        if parts.len() == 2 {
            let behind = parts[0].parse().unwrap_or(0);
            let ahead = parts[1].parse().unwrap_or(0);
            (ahead, behind)
        } else {
            (0, 0)
        }
    } else {
        (0, 0)
    };

    Ok(Json(GitStatus {
        current_branch: branch,
        files,
        branch_published,
        ahead,
        behind,
    }))
}
