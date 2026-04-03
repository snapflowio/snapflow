// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{helpers::git, types::GitCheckoutRequest};
use crate::common::errors::AppError;
use axum::{Json, http::StatusCode, response::IntoResponse};

#[utoipa::path(
    post,
    path = "/git/checkout",
    tag = "git",
    operation_id = "gitCheckout",
    request_body = GitCheckoutRequest,
    responses(
        (status = 200),
    )
)]
pub async fn checkout(Json(req): Json<GitCheckoutRequest>) -> Result<impl IntoResponse, AppError> {
    if git(&req.path, &["checkout", &req.branch]).await.is_err() {
        git(&req.path, &["checkout", "--detach", &req.branch]).await?;
    }
    Ok(StatusCode::OK)
}
