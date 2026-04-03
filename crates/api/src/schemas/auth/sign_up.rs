// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Deserialize;
use utoipa::ToSchema;
use validator::Validate;

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = SignUp)]
#[serde(rename_all = "camelCase")]
pub struct SignUpDto {
    #[validate(length(min = 1, max = 100))]
    #[schema(example = "John Doe")]
    pub name: String,
    #[validate(email)]
    #[schema(example = "john@example.com")]
    pub email: String,
    #[validate(length(min = 8, max = 72))]
    pub password: String,
}
