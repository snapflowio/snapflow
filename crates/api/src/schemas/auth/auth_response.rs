// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use utoipa::ToSchema;

use super::user_response::UserDto;

#[derive(Serialize, ToSchema)]
#[schema(as = Auth)]
#[serde(rename_all = "camelCase")]
pub struct AuthDto {
    pub user: UserDto,
    pub token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
}
