// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{helpers::git, types::GitAddRequest};
use snapflow_errors::AppError;
use axum::{Json, http::StatusCode, response::IntoResponse};

#[utoipa::path(
    post,
    path = "/git/add",
    tag = "git",
    operation_id = "gitAddFiles",
    request_body = GitAddRequest,
    responses(
        (status = 200),
    )
)]
pub async fn add_files(Json(req): Json<GitAddRequest>) -> Result<impl IntoResponse, AppError> {
    let mut args = vec!["add"];
    let file_refs: Vec<&str> = req.files.iter().map(String::as_str).collect();
    args.extend(file_refs);
    git(&req.path, &args).await?;
    Ok(StatusCode::OK)
}
