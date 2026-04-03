// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;

use crate::models::ApiKey;
use snapflow_models::OrganizationResourcePermission;

#[derive(Serialize, ToSchema)]
#[schema(as = ApiKeyCreated)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyCreatedDto {
    #[schema(example = "Test API Key")]
    pub name: String,
    #[schema(example = "snapflow_1234567890abcdef")]
    pub value: String,
    #[schema(inline)]
    pub permissions: Vec<OrganizationResourcePermission>,
    #[schema(example = "2025-07-01T12:00:00.000Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2025-07-01T12:00:00.000Z")]
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, ToSchema)]
#[schema(as = ApiKey)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyDto {
    #[schema(example = "Test API Key")]
    pub name: String,
    #[schema(example = "snapflow_************************")]
    pub value: String,
    #[schema(inline)]
    pub permissions: Vec<OrganizationResourcePermission>,
    #[schema(example = "2025-07-01T12:00:00.000Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2025-07-01T12:00:00.000Z")]
    pub last_used_at: Option<DateTime<Utc>>,
    #[schema(example = "2025-07-01T12:00:00.000Z")]
    pub expires_at: Option<DateTime<Utc>>,
}

impl ApiKeyDto {
    pub fn from_api_key(key: &ApiKey) -> Self {
        Self {
            name: key.name.clone(),
            value: format!("{}********************{}", key.key_prefix, key.key_suffix),
            permissions: key
                .permissions
                .iter()
                .filter_map(|p| p.parse().ok())
                .collect(),
            created_at: key.created_at,
            last_used_at: key.last_used_at,
            expires_at: key.expires_at,
        }
    }
}
