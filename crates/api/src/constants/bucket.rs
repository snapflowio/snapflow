// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub const R2_BUCKET_PREFIX: &str = "snapflow-bucket-";

pub const DESTROYED_CLEANUP_HOURS: i32 = 24;

pub fn r2_bucket_name(bucket_id: &uuid::Uuid) -> String {
    format!("{R2_BUCKET_PREFIX}{bucket_id}")
}

pub fn deleted_bucket_name(name: &str) -> String {
    format!("{name}-deleted")
}
