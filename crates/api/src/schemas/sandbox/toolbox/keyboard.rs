// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Deserialize;
use utoipa::ToSchema;
use validator::Validate;

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardTypeRequest {
    #[schema(example = "Hello, World!")]
    pub text: String,
    #[schema(example = 100)]
    pub delay: Option<i32>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardPressRequest {
    #[schema(example = "enter")]
    pub key: String,
    pub modifiers: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardHotkeyRequest {
    #[schema(example = "ctrl+c")]
    pub keys: String,
}
