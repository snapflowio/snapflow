// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use utoipa::ToSchema;

use super::sandbox_response::SandboxDto;

#[derive(Debug, Serialize, ToSchema)]
#[schema(as = PaginatedSandboxes)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedSandboxesDto {
    pub items: Vec<SandboxDto>,
    pub total: i64,
    pub page: i64,
    pub total_pages: i64,
}
