// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::Deserialize;
use utoipa::ToSchema;
use validator::Validate;

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = Suspend)]
#[serde(rename_all = "camelCase")]
pub struct SuspendDto {
    #[validate(length(min = 1))]
    pub reason: String,
    pub until: Option<DateTime<Utc>>,
}
