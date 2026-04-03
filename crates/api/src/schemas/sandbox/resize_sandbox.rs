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
#[schema(as = ResizeSandbox)]
#[serde(rename_all = "camelCase")]
pub struct ResizeSandboxDto {
    #[validate(range(min = 1))]
    pub cpu: i32,

    #[validate(range(min = 1))]
    #[serde(alias = "memory")]
    pub mem: i32,
}
