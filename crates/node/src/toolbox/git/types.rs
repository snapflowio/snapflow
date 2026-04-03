// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

#[derive(Deserialize, IntoParams)]
pub struct PathQuery {
    pub path: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct GitAddRequest {
    pub path: String,
    pub files: Vec<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct GitCloneRequest {
    pub url: String,
    pub path: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub branch: Option<String>,
    #[serde(rename = "commit_id")]
    pub commit_id: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct GitCommitRequest {
    pub path: String,
    pub message: String,
    pub author: String,
    pub email: String,
    #[serde(default)]
    pub allow_empty: bool,
}

#[derive(Serialize, ToSchema)]
pub struct GitCommitResponse {
    pub hash: String,
}

#[derive(Deserialize, ToSchema)]
pub struct GitBranchRequest {
    pub path: String,
    pub name: String,
}

#[derive(Deserialize, ToSchema)]
pub struct GitCheckoutRequest {
    pub path: String,
    pub branch: String,
}

#[derive(Deserialize, ToSchema)]
pub struct GitRepoRequest {
    pub path: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct ListBranchResponse {
    pub branches: Vec<String>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub current_branch: String,
    #[serde(rename = "fileStatus")]
    pub files: Vec<FileStatus>,
    pub branch_published: bool,
    pub ahead: i32,
    pub behind: i32,
}

#[derive(Serialize, ToSchema)]
pub struct FileStatus {
    pub name: String,
    pub extra: String,
    pub staging: String,
    pub worktree: String,
}

#[derive(Serialize, ToSchema)]
pub struct GitCommitInfo {
    pub hash: String,
    pub author: String,
    pub email: String,
    pub message: String,
    pub timestamp: String,
}
