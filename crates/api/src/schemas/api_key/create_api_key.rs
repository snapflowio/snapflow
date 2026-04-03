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

use snapflow_models::OrganizationResourcePermission;

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = CreateApiKey)]
#[serde(rename_all = "camelCase")]
pub struct CreateApiKeyDto {
    #[validate(length(min = 1, max = 100))]
    #[schema(example = "Test API Key")]
    pub name: String,
    #[schema(inline)]
    pub permissions: Vec<OrganizationResourcePermission>,
    #[schema(example = "2025-07-01T12:00:00.000Z")]
    pub expires_at: Option<DateTime<Utc>>,
}
