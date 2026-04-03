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
pub struct CreateSessionRequest {
    #[schema(example = "session-123")]
    pub session_id: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SessionExecuteRequest {
    #[schema(example = "ls -la")]
    pub command: String,
    #[schema(example = false)]
    pub run_async: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SessionExecuteResponse {
    #[schema(example = "cmd-123")]
    pub cmd_id: Option<String>,
    #[schema(example = "total 20\ndrwxr-xr-x  4 user group  128 Mar 15 10:30 .")]
    pub output: Option<String>,
    #[schema(example = 0)]
    pub exit_code: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Command {
    #[schema(example = "cmd-123")]
    pub id: String,
    #[schema(example = "ls -la")]
    pub command: String,
    #[schema(example = 0)]
    pub exit_code: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    #[schema(example = "session-123")]
    pub session_id: String,
    pub commands: Option<Vec<Command>>,
}
