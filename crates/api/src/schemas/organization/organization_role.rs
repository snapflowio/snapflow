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

use snapflow_models::OrganizationResourcePermission;

#[derive(Serialize, ToSchema)]
#[schema(as = OrganizationRole)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationRoleDto {
    pub id: Uuid,
    #[schema(example = "Billing")]
    pub name: String,
    #[schema(example = "Responsible for billing")]
    pub description: String,
    #[schema(inline)]
    pub permissions: Vec<OrganizationResourcePermission>,
    pub is_global: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = CreateOrganizationRole)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrganizationRoleDto {
    #[validate(length(min = 1))]
    #[schema(example = "Billing")]
    pub name: String,
    #[schema(example = "Responsible for billing")]
    pub description: String,
    #[validate(length(min = 1))]
    #[schema(inline)]
    pub permissions: Vec<OrganizationResourcePermission>,
}

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = UpdateOrganizationRole)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrganizationRoleDto {
    #[validate(length(min = 1))]
    #[schema(example = "Billing")]
    pub name: String,
    #[schema(example = "Responsible for billing")]
    pub description: String,
    #[validate(length(min = 1))]
    #[schema(inline)]
    pub permissions: Vec<OrganizationResourcePermission>,
}
