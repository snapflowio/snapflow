// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod sandbox {
    pub const AUTO_STOP_CHECK: &str = "auto-stop-check-worker-selected";
    pub const AUTO_ARCHIVE_CHECK: &str = "auto-archive-check-worker-selected";
    pub const AUTO_DELETE_CHECK: &str = "auto-delete-check-worker-selected";
    pub const SYNC_STATES: &str = "sync-states";
    pub const SYNC_INSTANCE_STATE_PREFIX: &str = "sync-instance-state-";

    pub fn sync_instance_state(sandbox_id: &str) -> String {
        format!("{SYNC_INSTANCE_STATE_PREFIX}{sandbox_id}")
    }
}

pub mod image {
    pub const SYNC_EXECUTOR_IMAGES: &str = "sync-executor-images-lock";
    pub const SYNC_EXECUTOR_IMAGE_STATES: &str = "sync-executor-image-states-lock";
    pub const CHECK_CLEANUP: &str = "check-image-cleanup-lock";
    pub const CLEANUP_OLD_BUILD_INFO: &str = "cleanup-old-buildinfo-images-lock";
    pub const DEACTIVATE_OLD_IMAGES: &str = "deactivate-old-images-lock";
    pub const CLEANUP_INACTIVE_FROM_EXECUTORS: &str = "cleanup-inactive-images-from-executors-lock";

    const CHECK_STATE_PREFIX: &str = "check-image-state-lock-";

    pub fn check_state(image_id: &str) -> String {
        format!("{CHECK_STATE_PREFIX}{image_id}")
    }
}

pub mod bucket {
    pub const PROCESS_PENDING: &str = "process-pending-buckets";

    const STATE_PREFIX: &str = "bucket-state-";

    pub fn state(bucket_id: &str) -> String {
        format!("{STATE_PREFIX}{bucket_id}")
    }
}

pub mod warm_pool {
    const SANDBOX_PREFIX: &str = "sandbox-warm-pool-";
    const TOPUP_PREFIX: &str = "warm-pool-lock-";

    pub fn sandbox(sandbox_id: &str) -> String {
        format!("{SANDBOX_PREFIX}{sandbox_id}")
    }

    pub fn topup(warm_pool_item_id: &str) -> String {
        format!("{TOPUP_PREFIX}{warm_pool_item_id}")
    }
}

pub mod usage {
    pub const CLOSE_AND_REOPEN: &str = "close-and-reopen-usage-periods";
    pub const ARCHIVE: &str = "archive-usage-periods";

    const PERIOD_PREFIX: &str = "usage-period-";

    pub fn period(sandbox_id: &str) -> String {
        format!("{PERIOD_PREFIX}{sandbox_id}")
    }
}

pub mod billing {
    pub const PROCESS_UNBILLED: &str = "process-unbilled-usage-periods";
    pub const CHECK_ZERO_BALANCE: &str = "check-zero-balance-suspension";
    pub const ENFORCE_TIER_COMPLIANCE: &str = "enforce-tier-compliance";
    pub const ENFORCE_SANDBOX_LIFETIME: &str = "enforce-sandbox-lifetime";
}

pub mod executor {
    pub const HEALTH_CHECK: &str = "executor-health-check";
}

pub mod organization {
    pub const STOP_SUSPENDED_SANDBOXES: &str = "stop-suspended-organization-sandboxes";
    pub const REMOVE_SUSPENDED_IMAGE_EXECUTORS: &str =
        "remove-suspended-organization-image-executors";
    pub const DEACTIVATE_SUSPENDED_IMAGES: &str = "deactivate-suspended-organization-images";
}
