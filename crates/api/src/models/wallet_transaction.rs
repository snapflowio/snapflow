// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WalletTransaction {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub amount: f64,
    pub balance_after: f64,
    pub description: String,
    pub sandbox_id: Option<Uuid>,
    pub usage_period_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
