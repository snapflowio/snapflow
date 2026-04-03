// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::Registry;
use snapflow_models::RegistryType;

#[derive(Serialize, ToSchema)]
#[schema(as = Registry)]
#[serde(rename_all = "camelCase")]
pub struct RegistryDto {
    #[schema(example = "123e4567-e89b-12d3-a456-426614174000")]
    pub id: Uuid,
    #[schema(example = "My Docker Hub")]
    pub name: String,
    #[schema(example = "https://registry.hub.docker.com")]
    pub url: String,
    #[schema(example = "username")]
    pub username: String,
    #[schema(example = "my-project")]
    pub project: String,
    #[schema(example = "internal", inline)]
    pub registry_type: RegistryType,
    #[schema(example = "2024-01-31T12:00:00Z")]
    pub created_at: DateTime<Utc>,
    #[schema(example = "2024-01-31T12:00:00Z")]
    pub updated_at: DateTime<Utc>,
}

impl From<&Registry> for RegistryDto {
    fn from(r: &Registry) -> Self {
        Self {
            id: r.id,
            name: r.name.clone(),
            url: r.url.clone(),
            username: r.username.clone(),
            project: r.project.clone(),
            registry_type: r.registry_type,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}
