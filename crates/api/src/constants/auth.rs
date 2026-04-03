// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub const SESSION_DURATION_DAYS: i64 = 30;
pub const SESSION_MAX_AGE: i64 = SESSION_DURATION_DAYS * 24 * 60 * 60;
pub const SESSION_REFRESH_THRESHOLD_DAYS: i64 = 15;
pub const SESSION_COOKIE_NAME: &str = "snapflow.session_token";
pub const VERIFICATION_EXPIRY_HOURS: i64 = 24;
pub const API_KEY_PREFIX: &str = "snapflow_";
pub const API_KEY_FRAGMENT_LENGTH: usize = 9;
pub const API_KEY_VALIDATION_CACHE_TTL_SECS: u64 = 10;
pub const API_KEY_USER_CACHE_TTL_SECS: u64 = 60;
pub const API_KEY_LAST_USED_COOLDOWN_SECS: u64 = 10;

pub const ACCESS_TOKEN_COOKIE: &str = "snapflow_token";
pub const REFRESH_TOKEN_COOKIE: &str = "snapflow_refresh_token";

pub const AUTH_CODE_PREFIX: &str = "oauth:code:";
pub const AUTH_CODE_TTL_SECS: u64 = 60;
pub const AUTH_CODE_LENGTH: usize = 32;
pub const ALLOWED_CLIENT_ID: &str = "snapflow-proxy";
