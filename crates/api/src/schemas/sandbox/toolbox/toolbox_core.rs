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
pub struct UploadFileRequest {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    #[schema(example = "main.rs")]
    pub name: String,
    pub is_dir: bool,
    #[schema(example = 1024)]
    pub size: i64,
    pub mod_time: String,
    pub mode: String,
    pub permissions: String,
    pub owner: String,
    pub group: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Match {
    pub file: String,
    pub line: i64,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilesResponse {
    pub files: Vec<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceRequest {
    pub files: Vec<String>,
    pub pattern: String,
    pub new_value: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceResult {
    pub file: Option<String>,
    pub success: Option<bool>,
    pub error: Option<String>,
}
