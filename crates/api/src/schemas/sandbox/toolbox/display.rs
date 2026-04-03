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
pub struct DisplayInfo {
    #[schema(example = 0)]
    pub id: i32,
    #[schema(example = 0)]
    pub x: i32,
    #[schema(example = 0)]
    pub y: i32,
    #[schema(example = 1024)]
    pub width: i32,
    #[schema(example = 768)]
    pub height: i32,
    #[schema(example = true)]
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfoResponse {
    pub displays: Vec<DisplayInfo>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    #[schema(example = 12345)]
    pub id: i32,
    #[schema(example = "Terminal")]
    pub title: String,
    #[schema(example = 0)]
    pub x: i32,
    #[schema(example = 0)]
    pub y: i32,
    #[schema(example = 800)]
    pub width: i32,
    #[schema(example = 600)]
    pub height: i32,
    #[schema(example = false)]
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WindowsResponse {
    pub windows: Vec<WindowInfo>,
    #[schema(example = 5)]
    pub count: i32,
}
