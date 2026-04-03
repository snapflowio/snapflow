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

use snapflow_models::{OrganizationInvitationStatus, OrganizationMemberRole};

use super::organization_role::OrganizationRoleDto;

#[derive(Serialize, ToSchema)]
#[schema(as = OrganizationInvitation)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationInvitationDto {
    pub id: Uuid,
    #[schema(example = "test@mail.com")]
    pub email: String,
    pub invited_by: String,
    pub organization_id: Uuid,
    pub organization_name: String,
    #[schema(inline)]
    pub role: OrganizationMemberRole,
    #[schema(inline)]
    pub status: OrganizationInvitationStatus,
    pub assigned_roles: Vec<OrganizationRoleDto>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = CreateInvitation)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvitationDto {
    #[validate(email)]
    #[schema(example = "test@mail.com")]
    pub email: String,
    #[schema(inline)]
    pub role: OrganizationMemberRole,
    pub assigned_role_ids: Option<Vec<Uuid>>,
    #[schema(example = "2025-07-03T23:59:59Z")]
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize, Validate, ToSchema)]
#[schema(as = UpdateInvitation)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInvitationDto {
    #[schema(inline)]
    pub role: OrganizationMemberRole,
    pub assigned_role_ids: Option<Vec<Uuid>>,
    #[schema(example = "2025-07-03T23:59:59Z")]
    pub expires_at: Option<DateTime<Utc>>,
}
