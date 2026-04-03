// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::time::Duration;

pub const REDIS_RESPONSE_TIMEOUT: Duration = Duration::from_secs(5);
pub const REDIS_CONNECTION_TIMEOUT: Duration = Duration::from_secs(10);
pub const PENDING_TTL_SECONDS: i64 = 300;
pub const SHUTDOWN_TASK_TIMEOUT: Duration = Duration::from_secs(30);

pub const DEFAULT_LOCK_POLL_INTERVAL: Duration = Duration::from_millis(50);
