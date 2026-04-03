// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::constants::sandbox::STOP_TIMEOUT_MINUTES;
use crate::executor;
use crate::infra::Infra;
use crate::models::Sandbox;
use crate::repositories;
use snapflow_errors::Result;
use snapflow_models::{BackupState, ExecutorState, SandboxState};

use super::sandbox_actions::{StateUpdate, SyncState, update_sandbox_state};

pub async fn run(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Stopped,
            StateUpdate {
                backup_state: Some(BackupState::None),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    };

    let Some(exec) = repositories::executor::find_by_id(&infra.pool, executor_id).await? else {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Stopped,
            StateUpdate {
                backup_state: Some(BackupState::None),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    };

    if exec.state != ExecutorState::Ready {
        return Ok(SyncState::Again);
    }

    let adapter = executor::create_adapter(&exec)?;

    match sandbox.state {
        SandboxState::Started => {
            adapter.stop_sandbox(&sandbox.id.to_string()).await?;
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Stopping,
                StateUpdate::default(),
            )
            .await?;
            Ok(SyncState::Again)
        }
        SandboxState::Stopping => {
            if check_stop_timeout(sandbox) {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Error,
                    StateUpdate {
                        error_reason: Some("sandbox stop timed out"),
                        ..Default::default()
                    },
                )
                .await?;
                return Ok(SyncState::Done);
            }

            let info = adapter.sandbox_info(&sandbox.id.to_string()).await?;
            match info.state {
                SandboxState::Stopped => {
                    update_sandbox_state(
                        infra,
                        sandbox.id,
                        SandboxState::Stopped,
                        StateUpdate {
                            backup_state: Some(BackupState::None),
                            ..Default::default()
                        },
                    )
                    .await?;
                    Ok(SyncState::Done)
                }
                SandboxState::Error => {
                    update_sandbox_state(
                        infra,
                        sandbox.id,
                        SandboxState::Error,
                        StateUpdate {
                            error_reason: Some("sandbox is in error state on executor"),
                            ..Default::default()
                        },
                    )
                    .await?;
                    Ok(SyncState::Done)
                }
                _ => Ok(SyncState::Again),
            }
        }
        SandboxState::Error => {
            let info = adapter.sandbox_info(&sandbox.id.to_string()).await?;
            if info.state == SandboxState::Stopped {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Stopped,
                    StateUpdate::default(),
                )
                .await?;
            }
            Ok(SyncState::Done)
        }
        _ => Ok(SyncState::Done),
    }
}

fn check_stop_timeout(sandbox: &Sandbox) -> bool {
    let elapsed = (chrono::Utc::now() - sandbox.updated_at).num_minutes();
    elapsed > STOP_TIMEOUT_MINUTES
}
