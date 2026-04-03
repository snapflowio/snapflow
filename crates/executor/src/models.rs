// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub use snapflow_models::{BackupState, SandboxState};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f64,
    pub ram_usage: f64,
    pub disk_usage: f64,
    pub allocated_cpu: i32,
    pub allocated_memory: i32,
    pub allocated_disk: i32,
    pub image_count: i32,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct CacheData {
    pub sandbox_state: SandboxState,
    pub backup_state: BackupState,
    pub backup_error: Option<String>,
    pub system_metrics: Option<SystemMetrics>,
}

impl Default for CacheData {
    fn default() -> Self {
        Self {
            sandbox_state: SandboxState::Unknown,
            backup_state: BackupState::None,
            backup_error: None,
            system_metrics: None,
        }
    }
}
