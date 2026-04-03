// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod backup {
    pub const SYNC_PENDING: &str = "*/10 * * * * *";
    pub const PROCESS_PENDING: &str = "*/10 * * * * *";
    pub const CHECK_PROGRESS: &str = "*/10 * * * * *";
    pub const AD_HOC_CHECK: &str = "0 */5 * * * *";
    pub const SYNC_STOP_STATE: &str = "*/10 * * * * *";
}

pub mod bucket {
    pub const PROCESS_PENDING: &str = "*/5 * * * * *";
}

pub mod sandbox {
    pub const AUTO_STOP_CHECK: &str = "0 * * * * *";
    pub const AUTO_ARCHIVE_CHECK: &str = "0 * * * * *";
    pub const AUTO_DELETE_CHECK: &str = "0 * * * * *";
    pub const SYNC_STATES: &str = "*/10 * * * * *";
    pub const CLEANUP_DESTROYED: &str = "0 */10 * * * *";
    pub const HANDLE_UNSCHEDULABLE: &str = "0 * * * * *";
}

pub mod image {
    pub const SYNC_EXECUTOR_IMAGES: &str = "*/5 * * * * *";
    pub const SYNC_EXECUTOR_IMAGE_STATES: &str = "*/10 * * * * *";
    pub const CHECK_IMAGE_STATES: &str = "*/10 * * * * *";
    pub const CHECK_IMAGE_CLEANUP: &str = "*/10 * * * * *";
    pub const VALIDATE_IMAGE_RUNTIME: &str = "0 */30 * * * *";
    pub const CLEANUP_OLD_BUILD_INFO: &str = "0 0 * * * *";
    pub const DEACTIVATE_OLD_IMAGES: &str = "0 */10 * * * *";
    pub const CLEANUP_INACTIVE_FROM_EXECUTORS: &str = "0 */10 * * * *";
}

pub mod executor {
    pub const HEALTH_CHECK: &str = "45 * * * * *";
}

pub mod warm_pool {
    pub const CHECK: &str = "*/10 * * * * *";
}

pub mod organization {
    pub const STOP_SUSPENDED_SANDBOXES: &str = "0 */10 * * * *";
    pub const REMOVE_SUSPENDED_IMAGE_EXECUTORS: &str = "0 */10 * * * *";
    pub const DEACTIVATE_SUSPENDED_IMAGES: &str = "0 */10 * * * *";
}

pub mod usage {
    pub const CLOSE_AND_REOPEN: &str = "0 * * * * *";
    pub const ARCHIVE: &str = "0 * * * * *";
}

pub mod billing {
    pub const PROCESS_UNBILLED: &str = "*/30 * * * * *";
    pub const CHECK_ZERO_BALANCE: &str = "*/30 * * * * *";
    pub const ENFORCE_TIER_COMPLIANCE: &str = "0 * * * * *";
    pub const ENFORCE_SANDBOX_LIFETIME: &str = "0 * * * * *";
}

pub mod auth {
    pub const CLEANUP_EXPIRED: &str = "0 0 * * * *";
}
