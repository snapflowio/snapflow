// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{
    helpers::git,
    types::{ListBranchResponse, PathQuery},
};
use snapflow_errors::AppError;
use axum::{Json, extract::Query};

#[utoipa::path(
    get,
    path = "/git/branches",
    tag = "git",
    operation_id = "listBranches",
    params(PathQuery),
    responses(
        (status = 200, body = ListBranchResponse),
    )
)]
pub async fn list_branches(
    Query(q): Query<PathQuery>,
) -> Result<Json<ListBranchResponse>, AppError> {
    let path = q
        .path
        .ok_or_else(|| AppError::bad_request("path is required"))?;
    let output = git(&path, &["branch", "-a", "--format=%(refname:short)"]).await?;
    let branches: Vec<String> = output.lines().map(|l| l.trim().to_string()).collect();
    Ok(Json(ListBranchResponse { branches }))
}
