// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{
    helpers::git,
    types::{GitCommitRequest, GitCommitResponse},
};
use crate::common::errors::AppError;
use axum::Json;

#[utoipa::path(
    post,
    path = "/git/commit",
    tag = "git",
    operation_id = "gitCommit",
    request_body = GitCommitRequest,
    responses(
        (status = 200, body = GitCommitResponse),
    )
)]
pub async fn commit(
    Json(req): Json<GitCommitRequest>,
) -> Result<Json<GitCommitResponse>, AppError> {
    let author = format!("{} <{}>", req.author, req.email);
    let mut args = vec!["commit", "-m", &req.message, "--author", &author];
    if req.allow_empty {
        args.push("--allow-empty");
    }
    git(&req.path, &args).await?;
    let hash = git(&req.path, &["rev-parse", "HEAD"]).await?;
    Ok(Json(GitCommitResponse { hash }))
}
