// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{
    helpers::{git, git_with_creds},
    types::GitCloneRequest,
};
use snapflow_errors::AppError;
use axum::{Json, http::StatusCode, response::IntoResponse};

#[utoipa::path(
    post,
    path = "/git/clone",
    tag = "git",
    operation_id = "cloneRepository",
    request_body = GitCloneRequest,
    responses(
        (status = 200),
    )
)]
pub async fn clone_repo(Json(req): Json<GitCloneRequest>) -> Result<impl IntoResponse, AppError> {
    let mut args: Vec<String> = vec!["clone".into(), "--single-branch".into()];

    if let Some(branch) = &req.branch {
        args.push("--branch".into());
        args.push(branch.clone());
    }

    args.push(req.url.clone());
    args.push(req.path.clone());

    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();

    if let (Some(u), Some(p)) = (&req.username, &req.password) {
        let output = git_with_creds(None, &arg_refs, u, p).await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::bad_request(stderr.trim().to_string()));
        }
    } else {
        let output = tokio::process::Command::new("git")
            .args(&arg_refs)
            .output()
            .await
            .map_err(|e| AppError::bad_request(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::bad_request(stderr.trim().to_string()));
        }
    }

    if let Some(commit_id) = &req.commit_id {
        git(&req.path, &["checkout", commit_id]).await?;
    }

    Ok(StatusCode::OK)
}
