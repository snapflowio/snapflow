// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::infra::Infra;
use crate::services;

pub async fn health_check(infra: &Infra) {
    services::executor::health_check_all(infra).await;
}
