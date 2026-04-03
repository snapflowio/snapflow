// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
#[schema(as = StorageAccess)]
#[serde(rename_all = "camelCase")]
pub struct StorageAccessDto {
    /// Pre-signed URL for uploading objects to R2 storage
    #[schema(example = "https://storage.example.com/upload?token=abc123")]
    pub upload_url: String,
    /// When the pre-signed URL expires (ISO 8601 timestamp)
    #[schema(example = "2025-02-12T22:00:00.000Z")]
    pub expires_at: String,
    /// Organization ID
    #[schema(example = "123e4567-e89b-12d3-a456-426614174000")]
    pub organization_id: String,
    /// R2 bucket name
    #[schema(example = "snapflow")]
    pub bucket: String,
    /// The path where the file will be stored in R2
    #[schema(example = "org-123/context.tar")]
    pub file_path: String,
}
