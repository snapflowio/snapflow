// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{
    helpers::{git, git_with_creds},
    types::GitRepoRequest,
};
use crate::common::errors::AppError;
use axum::{Json, http::StatusCode, response::IntoResponse};

#[utoipa::path(
    post,
    path = "/git/push",
    tag = "git",
    operation_id = "gitPush",
    request_body = GitRepoRequest,
    responses(
        (status = 200),
    )
)]
pub async fn push(Json(req): Json<GitRepoRequest>) -> Result<impl IntoResponse, AppError> {
    if let (Some(u), Some(p)) = (&req.username, &req.password) {
        let output = git_with_creds(Some(&req.path), &["push"], u, p).await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let msg = stderr.trim();
            if !msg.contains("Everything up-to-date") {
                return Err(AppError::bad_request(msg.to_string()));
            }
        }
    } else {
        let result = git(&req.path, &["push"]).await;
        if let Err(e) = &result
            && !e.message.contains("Everything up-to-date")
        {
            result?;
        }
    }

    Ok(StatusCode::OK)
}
