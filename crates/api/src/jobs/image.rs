// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::infra::Infra;
use crate::infra::docker::DockerClient;
use crate::services;

pub async fn sync_executor_images(infra: &Infra) {
    services::image::sync_executor_images(infra).await;
}

pub async fn sync_executor_image_states(infra: &Infra) {
    services::image::sync_executor_image_states(infra).await;
}

pub async fn check_image_states(infra: &Infra) {
    services::image::check_image_states(infra).await;
}

pub async fn check_image_cleanup(infra: &Infra) {
    services::image::check_image_cleanup(infra).await;
}

pub async fn cleanup_old_build_info(infra: &Infra) {
    services::image::cleanup_old_build_info(infra).await;
}

pub async fn deactivate_old_images(infra: &Infra) {
    services::image::deactivate_old_images(infra).await;
}

pub async fn cleanup_inactive_from_executors(infra: &Infra) {
    services::image::cleanup_inactive_from_executors(infra).await;
}

pub async fn cleanup_local_images(docker: &DockerClient) {
    services::image::cleanup_local_images(docker).await;
}
