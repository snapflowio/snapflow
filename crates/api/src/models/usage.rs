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
pub struct SandboxUsagePeriod {
    pub id: Uuid,
    pub sandbox_id: Uuid,
    pub organization_id: Uuid,
    pub start_at: DateTime<Utc>,
    pub end_at: Option<DateTime<Utc>>,
    pub cpu: f64,
    pub gpu: f64,
    pub mem: f64,
    pub disk: f64,
    pub region: String,
    pub billed: bool,
}
