// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::infra::Infra;
use common_rs::middleware::rate_limit::KeyedRateLimiter;

#[derive(Clone)]
pub struct AppState {
    pub infra: Infra,
    pub rate_limiter: KeyedRateLimiter,
    pub auth_rate_limiter: KeyedRateLimiter,
}
