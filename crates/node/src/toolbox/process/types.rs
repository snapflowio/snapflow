// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct ExecuteRequest {
    pub command: String,
    pub timeout: Option<u32>,
    pub cwd: Option<String>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResponse {
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
    pub result: String,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CodeRunRequest {
    pub language: String,
    pub code: Option<String>,
    pub files: Option<Vec<CodeFile>>,
    pub entrypoint: Option<String>,
    pub timeout: Option<u64>,
    pub work_dir: Option<String>,
    pub env: Option<std::collections::HashMap<String, String>>,
}

#[derive(Deserialize, ToSchema)]
pub struct CodeFile {
    pub path: String,
    pub content: String,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CodeRunResponse {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration: i64,
}
