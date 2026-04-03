// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CursorPosition {
    #[schema(example = 500)]
    pub x: i32,
    #[schema(example = 300)]
    pub y: i32,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotResponse {
    #[schema(
        example = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    )]
    pub screenshot: String,
    pub cursor_position: Option<CursorPosition>,
    #[schema(example = 24576)]
    pub size_bytes: Option<i64>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegionScreenshotRequest {
    #[schema(example = 100)]
    pub x: i32,
    #[schema(example = 100)]
    pub y: i32,
    #[schema(example = 800)]
    pub width: i32,
    #[schema(example = 600)]
    pub height: i32,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegionScreenshotResponse {
    #[schema(
        example = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    )]
    pub screenshot: String,
    pub cursor_position: Option<CursorPosition>,
    #[schema(example = 24576)]
    pub size_bytes: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CompressedScreenshotResponse {
    #[schema(
        example = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    )]
    pub screenshot: String,
    pub cursor_position: Option<CursorPosition>,
    #[schema(example = 12288)]
    pub size_bytes: Option<i64>,
}
