// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::infra::Infra;
use crate::services;

pub async fn stop_suspended_sandboxes(infra: &Infra) {
    services::organization::stop_suspended_sandboxes(infra).await;
}

pub async fn remove_suspended_image_executors(infra: &Infra) {
    services::organization::remove_suspended_image_executors(infra).await;
}

pub async fn deactivate_suspended_images(infra: &Infra) {
    services::organization::deactivate_suspended_images(infra).await;
}
