// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitAddRequest {
    pub path: String,
    pub files: Vec<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchRequest {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitDeleteBranchRequest {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitCloneRequest {
    pub url: String,
    pub path: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub branch: Option<String>,
    pub commit_id: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitRequest {
    pub path: String,
    pub message: String,
    pub author: String,
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitResponse {
    pub hash: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitCheckoutRequest {
    pub path: String,
    pub branch: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoRequest {
    pub path: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub name: String,
    pub staging: String,
    pub worktree: String,
    pub extra: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub current_branch: String,
    pub file_status: Vec<FileStatus>,
    pub ahead: Option<i32>,
    pub behind: Option<i32>,
    pub branch_published: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListBranchResponse {
    pub branches: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub timestamp: String,
}
