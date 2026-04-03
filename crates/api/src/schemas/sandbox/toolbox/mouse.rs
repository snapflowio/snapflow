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
pub struct MousePosition {
    #[schema(example = 100)]
    pub x: i32,
    #[schema(example = 200)]
    pub y: i32,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MouseMoveRequest {
    #[schema(example = 150)]
    pub x: i32,
    #[schema(example = 250)]
    pub y: i32,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MouseMoveResponse {
    #[schema(example = 150)]
    pub x: i32,
    #[schema(example = 250)]
    pub y: i32,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MouseClickRequest {
    #[schema(example = 100)]
    pub x: i32,
    #[schema(example = 200)]
    pub y: i32,
    #[schema(example = "left")]
    pub button: Option<String>,
    #[schema(example = false)]
    pub double: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MouseClickResponse {
    #[schema(example = 100)]
    pub x: i32,
    #[schema(example = 200)]
    pub y: i32,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MouseDragRequest {
    #[schema(example = 100)]
    pub start_x: i32,
    #[schema(example = 200)]
    pub start_y: i32,
    #[schema(example = 300)]
    pub end_x: i32,
    #[schema(example = 400)]
    pub end_y: i32,
    #[schema(example = "left")]
    pub button: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MouseDragResponse {
    #[schema(example = 300)]
    pub x: i32,
    #[schema(example = 400)]
    pub y: i32,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MouseScrollRequest {
    #[schema(example = 100)]
    pub x: i32,
    #[schema(example = 200)]
    pub y: i32,
    #[schema(example = "down")]
    pub direction: String,
    #[schema(example = 3)]
    pub amount: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MouseScrollResponse {
    #[schema(example = true)]
    pub success: bool,
}
