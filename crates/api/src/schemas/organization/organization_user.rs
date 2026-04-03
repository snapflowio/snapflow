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

use snapflow_models::OrganizationMemberRole;

use super::organization_role::OrganizationRoleDto;

#[derive(Serialize, ToSchema)]
#[schema(as = OrganizationUser)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationUserDto {
    pub user_id: Uuid,
    pub organization_id: Uuid,
    pub name: String,
    pub email: String,
    #[schema(inline)]
    pub role: OrganizationMemberRole,
    pub assigned_roles: Vec<OrganizationRoleDto>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = UpdateMemberRole)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMemberRoleDto {
    #[schema(inline)]
    pub role: OrganizationMemberRole,
}

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = UpdateAssignedRoles)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAssignedRolesDto {
    pub role_ids: Vec<Uuid>,
}
