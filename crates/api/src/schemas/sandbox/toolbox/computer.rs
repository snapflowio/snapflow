// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ComputerStartResponse {
    #[schema(example = "Computer processes started successfully")]
    pub message: String,
    pub status: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ComputerStopResponse {
    #[schema(example = "Computer processes stopped successfully")]
    pub message: String,
    pub status: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ComputerStatusResponse {
    #[schema(example = "active")]
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStatusResponse {
    #[schema(example = "xfce4")]
    pub process_name: String,
    #[schema(example = true)]
    pub running: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProcessRestartResponse {
    #[schema(example = "Process xfce4 restarted successfully")]
    pub message: String,
    #[schema(example = "xfce4")]
    pub process_name: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProcessLogsResponse {
    #[schema(example = "novnc")]
    pub process_name: String,
    #[schema(example = "2024-01-15 10:30:45 [INFO] NoVNC server started on port 6080")]
    pub logs: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProcessErrorsResponse {
    #[schema(example = "x11vnc")]
    pub process_name: String,
    #[schema(example = "2024-01-15 10:30:45 [ERROR] Failed to bind to port 5901")]
    pub errors: String,
}
