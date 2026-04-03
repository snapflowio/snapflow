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
#[schema(as = ChangePassword)]
pub struct ChangePasswordDto {
    pub current_password: String,
    #[validate(length(min = 8, max = 72))]
    pub new_password: String,
    #[serde(default)]
    pub revoke_other_sessions: bool,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(as = ChangePasswordResponse)]
pub struct ChangePasswordResponseDto {
    pub status: bool,
}
