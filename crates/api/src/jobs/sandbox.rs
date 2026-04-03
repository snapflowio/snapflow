// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::PgPool;

use crate::infra::Infra;
use crate::services;

pub async fn cleanup_destroyed(pool: &PgPool) {
    services::sandbox::cleanup_destroyed(pool).await;
}

pub async fn handle_unschedulable_executors(infra: &Infra) {
    services::sandbox::handle_unschedulable_executors(infra).await;
}

pub async fn sync_states(infra: &Infra) {
    services::sandbox_actions::sync_states(infra).await;
}

pub async fn auto_stop_check(infra: &Infra) {
    services::sandbox_actions::auto_stop_check(infra).await;
}

pub async fn auto_archive_check(infra: &Infra) {
    services::sandbox_actions::auto_archive_check(infra).await;
}

pub async fn auto_delete_check(infra: &Infra) {
    services::sandbox_actions::auto_delete_check(infra).await;
}
