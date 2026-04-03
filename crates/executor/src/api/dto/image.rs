// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use super::registry::RegistryDTO;

#[derive(Debug, Clone, Deserialize, ToSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct PullImageRequestDTO {
    #[validate(length(min = 1))]
    pub image: String,
    pub registry: Option<RegistryDTO>,
}

#[derive(Debug, Clone, Deserialize, ToSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct BuildImageRequestDTO {
    /// Image ID and tag or the build's hash
    pub image: String,
    pub registry: Option<RegistryDTO>,
    #[validate(length(min = 1))]
    pub dockerfile: String,
    #[validate(length(min = 1))]
    pub organization_id: String,
    pub context: Option<Vec<String>>,
    pub push_to_internal_registry: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, ToSchema, Validate)]
#[serde(rename_all = "camelCase")]
pub struct TagImageRequestDTO {
    #[validate(length(min = 1))]
    #[schema(example = "myimage:1.0")]
    pub source_image: String,
    #[validate(length(min = 1))]
    #[schema(example = "registry.example.com/myorg/myimage:1.0")]
    pub target_image: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ImageExistsResponse {
    #[schema(example = true)]
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ImageInfoResponse {
    #[schema(example = "nginx:latest")]
    pub name: String,
    #[schema(example = 0.13)]
    pub size_gb: f64,
    #[schema(example = json!(["nginx", "-g", "daemon off;"]))]
    pub entrypoint: Option<Vec<String>>,
    #[schema(example = json!(["nginx", "-g", "daemon off;"]))]
    pub cmd: Option<Vec<String>>,
    #[schema(example = "a7be6198544f09a75b26e6376459b47c5b9972e7351d440e092c4faa9ea064ff")]
    pub hash: String,
}
