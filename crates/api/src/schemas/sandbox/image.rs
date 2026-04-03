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

use crate::models::{BuildInfo, Image};
use snapflow_models::ImageState;

use super::build_info::{BuildInfoDto, CreateBuildInfoDto};

#[derive(Debug, Clone, Serialize, ToSchema)]
#[schema(as = Image)]
#[serde(rename_all = "camelCase")]
pub struct ImageDto {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub general: bool,
    #[schema(example = "ubuntu-4vcpu-8ram-100gb")]
    pub name: String,
    #[schema(example = "ubuntu:22.04")]
    pub image_name: Option<String>,
    pub state: ImageState,
    pub size: Option<f32>,
    pub entrypoint: Option<Vec<String>>,
    #[schema(example = 4)]
    pub cpu: i32,
    #[schema(example = 0)]
    pub gpu: i32,
    #[schema(example = 8)]
    pub mem: i32,
    #[schema(example = 30)]
    pub disk: i32,
    pub error_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub build_info: Option<BuildInfoDto>,
}

impl ImageDto {
    pub fn from_image(image: &Image, build_info: Option<&BuildInfo>) -> Self {
        Self {
            id: image.id,
            organization_id: image.organization_id,
            general: image.general,
            name: image.name.clone(),
            image_name: Some(image.image_name.clone()),
            state: image.state,
            size: image.size,
            entrypoint: image.entrypoint.clone(),
            cpu: image.cpu,
            gpu: image.gpu,
            mem: image.mem,
            disk: image.disk,
            error_reason: image.error_reason.clone(),
            created_at: image.created_at,
            updated_at: image.updated_at,
            last_used_at: image.last_used_at,
            build_info: build_info.map(BuildInfoDto::from),
        }
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[schema(as = CreateImage)]
#[serde(rename_all = "camelCase")]
pub struct CreateImageDto {
    #[validate(length(min = 1))]
    #[schema(example = "ubuntu-4vcpu-8ram-100gb")]
    pub name: String,
    #[schema(example = "ubuntu:22.04")]
    pub image_name: Option<String>,
    #[schema(example = json!(["sleep", "infinity"]))]
    pub entrypoint: Option<Vec<String>>,
    #[schema(example = json!([]))]
    pub cmd: Option<Vec<String>>,
    pub general: Option<bool>,
    #[schema(example = 4)]
    pub cpu: Option<i32>,
    #[schema(example = 0)]
    pub gpu: Option<i32>,
    #[schema(example = 8)]
    pub memory: Option<i32>,
    #[schema(example = 30)]
    pub disk: Option<i32>,
    pub build_info: Option<CreateBuildInfoDto>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[schema(as = SetImageGeneralStatus)]
#[serde(rename_all = "camelCase")]
pub struct SetImageGeneralStatusDto {
    #[schema(example = true)]
    pub general: bool,
}

#[derive(Debug, Serialize, ToSchema)]
#[schema(as = PaginatedImages)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedImagesDto {
    pub items: Vec<ImageDto>,
    pub total: i64,
    pub page: i64,
    pub total_pages: i64,
}
