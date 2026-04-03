// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::models::BuildInfo;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = BuildInfo)]
#[serde(rename_all = "camelCase")]
pub struct BuildInfoDto {
    #[schema(
        example = "FROM node:14\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD [\"npm\", \"start\"]"
    )]
    pub dockerfile_content: Option<String>,
    #[schema(example = json!(["hash1", "hash2"]))]
    pub context_hashes: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&BuildInfo> for BuildInfoDto {
    fn from(b: &BuildInfo) -> Self {
        Self {
            dockerfile_content: b.dockerfile_content.clone(),
            context_hashes: b.context_hashes.clone(),
            created_at: b.created_at,
            updated_at: b.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[schema(as = CreateBuildInfo)]
#[serde(rename_all = "camelCase")]
pub struct CreateBuildInfoDto {
    #[validate(length(min = 1))]
    #[schema(
        example = "FROM node:14\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD [\"npm\", \"start\"]"
    )]
    pub dockerfile_content: String,
    #[schema(example = json!(["hash1", "hash2"]))]
    pub context_hashes: Option<Vec<String>>,
}
