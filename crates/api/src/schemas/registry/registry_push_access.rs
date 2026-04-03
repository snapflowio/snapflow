// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, ToSchema)]
#[schema(as = RegistryPushAccess)]
#[serde(rename_all = "camelCase")]
pub struct RegistryPushAccessDto {
    #[schema(example = "temp-user-123")]
    pub username: String,
    #[schema(example = "eyJhbGciOiJIUzI1NiIs...")]
    pub secret: String,
    #[schema(example = "123e4567-e89b-12d3-a456-426614174000")]
    pub registry_id: Uuid,
    #[schema(example = "registry.example.com")]
    pub registry_url: String,
    #[schema(example = "library")]
    pub project: String,
    #[schema(example = "2023-12-31T23:59:59Z")]
    pub expires_at: String,
}
