// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use snapflow_models::SandboxState;

use crate::constants::{lock_keys, lock_ttls};
use crate::infra::Infra;
use crate::models::Sandbox;
use crate::repositories;

const COMPUTE_CONSUMING_STATES: &[SandboxState] = &[
    SandboxState::Creating,
    SandboxState::Restoring,
    SandboxState::Started,
    SandboxState::Starting,
    SandboxState::Stopping,
    SandboxState::Resizing,
    SandboxState::PendingBuild,
    SandboxState::BuildingImage,
    SandboxState::Unknown,
    SandboxState::PullingImage,
];

const DISK_ONLY_STATES: &[SandboxState] = &[SandboxState::Stopped, SandboxState::Archiving];

fn is_compute_consuming(state: SandboxState) -> bool {
    COMPUTE_CONSUMING_STATES.contains(&state)
}

fn is_disk_only(state: SandboxState) -> bool {
    DISK_ONLY_STATES.contains(&state)
}

fn is_terminal(state: SandboxState) -> bool {
    matches!(
        state,
        SandboxState::Error
            | SandboxState::BuildFailed
            | SandboxState::Archived
            | SandboxState::Destroyed
    )
}

pub async fn handle_sandbox_state_update(
    infra: &Infra,
    sandbox: &Sandbox,
    new_state: SandboxState,
) {
    let lock_key = lock_keys::usage::period(&sandbox.id.to_string());

    let lock_code = match infra.lock.lock(&lock_key, lock_ttls::usage::PERIOD).await {
        Ok(Some(code)) => code,
        Ok(None) => return,
        Err(e) => {
            tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to acquire usage period lock");
            return;
        }
    };

    if let Err(e) = repositories::usage::close_active_periods(&infra.pool, sandbox.id).await {
        tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to close active usage periods");
        unlock_warn(&infra, &lock_key, &lock_code).await;
        return;
    }

    if is_compute_consuming(new_state) {
        if let Err(e) = repositories::usage::create_period(
            &infra.pool,
            sandbox.id,
            sandbox.organization_id,
            f64::from(sandbox.cpu),
            f64::from(sandbox.gpu),
            f64::from(sandbox.mem),
            f64::from(sandbox.disk),
            &sandbox.region,
        )
        .await
        {
            tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to create compute usage period");
        }
    } else if is_disk_only(new_state) {
        if let Err(e) = repositories::usage::create_period(
            &infra.pool,
            sandbox.id,
            sandbox.organization_id,
            0.0,
            0.0,
            0.0,
            f64::from(sandbox.disk),
            &sandbox.region,
        )
        .await
        {
            tracing::warn!(sandbox_id = %sandbox.id, error = %e, "failed to create disk-only usage period");
        }
    } else if is_terminal(new_state) {
        tracing::debug!(sandbox_id = %sandbox.id, state = ?new_state, "terminal state, no new usage period");
    }

    unlock_warn(&infra, &lock_key, &lock_code).await;
}

async fn unlock_warn(infra: &Infra, key: &str, code: &str) {
    if let Err(e) = infra.lock.unlock(key, code).await {
        tracing::warn!(key, error = %e, "failed to release usage period lock");
    }
}
