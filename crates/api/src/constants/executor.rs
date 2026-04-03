// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::time::Duration;

pub const MAX_CONCURRENT_IMAGE_BUILDS_PER_EXECUTOR: i64 = 6;
pub const MAX_CONCURRENT_BACKUPS_PER_EXECUTOR: i64 = 6;
pub const RETRY_MAX_TIMES: usize = 3;
pub const SHORT_REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
