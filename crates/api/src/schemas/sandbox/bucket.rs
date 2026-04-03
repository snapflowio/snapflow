// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::models::Bucket;
use snapflow_models::BucketState;

#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(as = Bucket)]
#[serde(rename_all = "camelCase")]
pub struct BucketDto {
    #[schema(example = "vol-12345678")]
    pub id: Uuid,
    #[schema(example = "my-bucket")]
    pub name: String,
    #[schema(example = "123e4567-e89b-12d3-a456-426614174000")]
    pub organization_id: Option<Uuid>,
    pub state: BucketState,
    #[schema(example = "2023-01-01T00:00:00.000Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2023-01-01T00:00:00.000Z")]
    pub updated_at: DateTime<Utc>,
    #[schema(example = "2023-01-01T00:00:00.000Z")]
    pub last_used_at: Option<DateTime<Utc>>,
    #[schema(example = "Error processing bucket")]
    pub error_reason: Option<String>,
}

impl From<&Bucket> for BucketDto {
    fn from(b: &Bucket) -> Self {
        Self {
            id: b.id,
            name: b.name.clone(),
            organization_id: b.organization_id,
            state: b.state,
            created_at: b.created_at,
            updated_at: b.updated_at,
            last_used_at: b.last_used_at,
            error_reason: b.error_reason.clone(),
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[schema(as = CreateBucket)]
#[serde(rename_all = "camelCase")]
pub struct CreateBucketDto {
    pub name: Option<String>,
}
