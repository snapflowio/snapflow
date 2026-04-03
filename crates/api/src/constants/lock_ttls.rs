// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod bucket {
    pub const PROCESS_PENDING: u64 = 30;
    pub const STATE: u64 = 30;
}

pub mod sandbox {
    pub const AUTO_STOP_CHECK: u64 = 60;
    pub const AUTO_ARCHIVE_CHECK: u64 = 60;
    pub const AUTO_DELETE_CHECK: u64 = 60;
    pub const SYNC_STATES: u64 = 30;
    pub const SYNC_INSTANCE_STATE: u64 = 360;
    pub const SYNC_INSTANCE_STATE_SHORT: u64 = 30;
}

pub mod image {
    pub const SYNC_EXECUTOR_IMAGES: u64 = 30;
    pub const SYNC_EXECUTOR_IMAGE_STATES: u64 = 30;
    pub const CHECK_CLEANUP: u64 = 30;
    pub const CHECK_STATE: u64 = 720;
    pub const CLEANUP_OLD_BUILD_INFO: u64 = 300;
    pub const DEACTIVATE_OLD_IMAGES: u64 = 300;
    pub const CLEANUP_INACTIVE_FROM_EXECUTORS: u64 = 300;
}

pub mod warm_pool {
    pub const SANDBOX: u64 = 10;
    pub const TOPUP: u64 = 720;
}

pub mod usage {
    pub const PERIOD: u64 = 60;
    pub const CLOSE_AND_REOPEN: u64 = 60;
    pub const ARCHIVE: u64 = 60;
}

pub mod billing {
    pub const PROCESS_UNBILLED: u64 = 30;
    pub const CHECK_ZERO_BALANCE: u64 = 30;
    pub const ENFORCE_TIER_COMPLIANCE: u64 = 60;
    pub const ENFORCE_SANDBOX_LIFETIME: u64 = 60;
}

pub mod executor {
    pub const HEALTH_CHECK: u64 = 60;
}

pub mod organization {
    pub const STOP_SUSPENDED_SANDBOXES: u64 = 60;
    pub const REMOVE_SUSPENDED_IMAGE_EXECUTORS: u64 = 60;
    pub const DEACTIVATE_SUSPENDED_IMAGES: u64 = 60;
}
