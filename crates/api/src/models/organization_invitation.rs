// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use snapflow_models::{OrganizationInvitationStatus, OrganizationMemberRole};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OrganizationInvitation {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub email: String,
    pub invited_by: String,
    pub role: OrganizationMemberRole,
    pub expires_at: DateTime<Utc>,
    pub status: OrganizationInvitationStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
