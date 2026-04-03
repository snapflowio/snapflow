// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{helpers::git, types::GitBranchRequest};
use crate::common::errors::AppError;
use axum::{Json, http::StatusCode, response::IntoResponse};

#[utoipa::path(
    post,
    path = "/git/branches",
    tag = "git",
    operation_id = "createBranch",
    request_body = GitBranchRequest,
    responses(
        (status = 201),
    )
)]
pub async fn create_branch(
    Json(req): Json<GitBranchRequest>,
) -> Result<impl IntoResponse, AppError> {
    git(&req.path, &["checkout", "-b", &req.name]).await?;
    Ok(StatusCode::CREATED)
}
