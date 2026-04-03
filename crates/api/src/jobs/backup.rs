// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::infra::Infra;
use crate::services;

pub async fn sync_pending(infra: &Infra) {
    services::backup::sync_pending_backups(infra).await;
}

pub async fn process_pending(infra: &Infra) {
    services::backup::process_pending_backups(infra).await;
}

pub async fn check_progress(infra: &Infra) {
    services::backup::check_backup_progress(infra).await;
}

pub async fn ad_hoc_check(infra: &Infra) {
    services::backup::ad_hoc_backup_check(infra).await;
}

pub async fn sync_stop_state(infra: &Infra) {
    services::backup::sync_stop_state_create_backups(infra).await;
}
