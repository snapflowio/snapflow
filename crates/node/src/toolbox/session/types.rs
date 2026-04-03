// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio_util::sync::CancellationToken;
use utoipa::{IntoParams, ToSchema};

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionRequest {
    pub session_id: String,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SessionExecuteRequest {
    pub command: String,
    #[serde(default)]
    pub run_async: bool,
    #[serde(default, rename = "async")]
    pub is_async: bool,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SessionExecuteResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cmd_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stdout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stderr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SessionDto {
    pub session_id: String,
    pub commands: Vec<CommandDto>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CommandDto {
    pub id: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
}

#[derive(Deserialize, IntoParams)]
pub struct FollowQuery {
    pub follow: Option<String>,
}

#[derive(Clone)]
pub struct CommandEntry {
    pub id: String,
    pub command: String,
    pub exit_code: Option<i32>,
}

pub struct SessionInner {
    pub stdin: tokio::process::ChildStdin,
    pub commands: DashMap<String, CommandEntry>,
    pub _child: tokio::process::Child,
    pub cancel: CancellationToken,
}

impl SessionInner {
    pub fn dir(config_dir: &str, session_id: &str) -> PathBuf {
        PathBuf::from(config_dir).join("sessions").join(session_id)
    }

    pub fn log_file_path(config_dir: &str, session_id: &str, cmd_id: &str) -> (PathBuf, PathBuf) {
        let dir = Self::dir(config_dir, session_id).join(cmd_id);
        (dir.join("output.log"), dir.join("exit_code"))
    }
}
