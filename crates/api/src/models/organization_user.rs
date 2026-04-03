// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use snapflow_models::OrganizationMemberRole;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OrganizationUser {
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub role: OrganizationMemberRole,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
