// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::time::Duration;

pub const WARM_POOL_UNASSIGNED_ORGANIZATION: uuid::Uuid = uuid::Uuid::nil();
pub const DEFAULT_AUTO_STOP_INTERVAL: i32 = 15;
pub const DEFAULT_AUTO_ARCHIVE_INTERVAL: i32 = 7 * 24 * 60;

pub const DEFAULT_SANDBOX_CPU: i32 = 2;
pub const DEFAULT_SANDBOX_MEMORY: i32 = 512;
pub const DEFAULT_SANDBOX_DISK: i32 = 2;
pub const DEFAULT_SANDBOX_GPU: i32 = 0;

pub const DEFAULT_IMAGE_CPU: i32 = 2;
pub const DEFAULT_IMAGE_MEMORY: i32 = 512;
pub const DEFAULT_IMAGE_DISK: i32 = 2;

pub const STOP_TIMEOUT_MINUTES: i64 = 10;
pub const STARTING_TIMEOUT_MINUTES: i64 = 5;
pub const CREATING_TIMEOUT_MINUTES: i64 = 15;
pub const RESTORING_TIMEOUT_MINUTES: i64 = 30;
pub const BUILDING_IMAGE_TIMEOUT_MINUTES: i64 = 60;
pub const MAX_BUILD_RETRIES: u32 = 10;
pub const MAX_ARCHIVE_BACKUP_RETRIES: i64 = 3;
pub const MAX_SYNC_ITERATIONS: u32 = 600;
pub const SYNC_LOOP_DELAY: Duration = Duration::from_millis(100);
pub const MAX_CONCURRENT_SYNCS: usize = 10;
pub const MAX_NETWORK_ALLOW_LIST_ENTRIES: usize = 5;

pub const RECOVERY_ERROR_SUBSTRINGS: &[&str] = &[
    "can not connect to the docker daemon",
    "cannot connect to the docker daemon",
    "no such container",
    "container not found",
    "is not running",
];
pub const RECOVERY_COOLDOWN_SECS: u64 = 6 * 60 * 60;

pub mod events {
    pub const STATE_UPDATED: &str = "sandbox.state.updated";
    pub const DESIRED_STATE_UPDATED: &str = "sandbox.desired-state.updated";
    pub const CREATED: &str = "sandbox.created";
    pub const STARTED: &str = "sandbox.started";
    pub const STOPPED: &str = "sandbox.stopped";
    pub const DESTROYED: &str = "sandbox.destroyed";
    pub const RESIZED: &str = "sandbox.resized";
    pub const PUBLIC_STATUS_UPDATED: &str = "sandbox.public-status.updated";
    pub const ORGANIZATION_UPDATED: &str = "sandbox.organization.updated";
}

pub mod image_events {
    pub const CREATED: &str = "image.created";
    pub const STATE_UPDATED: &str = "image.state.updated";
    pub const REMOVED: &str = "image.removed";
}

pub mod bucket_events {
    pub const CREATED: &str = "bucket.created";
    pub const STATE_UPDATED: &str = "bucket.state.updated";
    pub const LAST_USED_AT_UPDATED: &str = "bucket.lastUsedAt.updated";
}

pub mod warmpool_events {
    pub const TOPUP_REQUESTED: &str = "warmpool.topup-requested";
}
