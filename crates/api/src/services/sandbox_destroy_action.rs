// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::executor;
use crate::infra::Infra;
use crate::models::Sandbox;
use crate::repositories;
use snapflow_errors::Result;
use snapflow_models::{BackupState, ExecutorState, SandboxState};

use super::sandbox_actions::{StateUpdate, SyncState, update_sandbox_state};

pub async fn run(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    if sandbox.state == SandboxState::Archived {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Destroyed,
            StateUpdate {
                backup_state: Some(BackupState::None),
                ..Default::default()
            },
        )
        .await?;
        return Ok(SyncState::Done);
    }

    let Some(executor_id) = sandbox.executor_id else {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Destroyed,
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
            SandboxState::Destroyed,
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
    let sandbox_id_str = sandbox.id.to_string();

    match sandbox.state {
        SandboxState::Destroyed => Ok(SyncState::Done),
        SandboxState::Destroying => {
            match adapter.sandbox_info(&sandbox_id_str).await {
                Ok(info) => {
                    if matches!(info.state, SandboxState::Destroyed | SandboxState::Error)
                        && let Err(e) = adapter.remove_destroyed_sandbox(&sandbox_id_str).await
                    {
                        tracing::warn!(sandbox_id = %sandbox_id_str, error = %e, "failed to remove destroyed sandbox from executor");
                    }
                }
                Err(e) => {
                    let msg = e.to_string();
                    if !msg.contains("404") && !msg.contains("not found") {
                        return Err(e);
                    }
                }
            }

            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Destroyed,
                StateUpdate::default(),
            )
            .await?;
            Ok(SyncState::Done)
        }
        _ => {
            let already_destroyed = match adapter.sandbox_info(&sandbox_id_str).await {
                Ok(info) => {
                    if info.state == SandboxState::Destroyed {
                        true
                    } else {
                        adapter.destroy_sandbox(&sandbox_id_str).await?;
                        false
                    }
                }
                Err(e) => {
                    let msg = e.to_string();
                    if msg.contains("404") || msg.contains("not found") {
                        true
                    } else {
                        return Err(e);
                    }
                }
            };

            if already_destroyed {
                if let Err(e) = adapter.remove_destroyed_sandbox(&sandbox_id_str).await {
                    tracing::warn!(sandbox_id = %sandbox_id_str, error = %e, "failed to remove already-destroyed sandbox from executor");
                }
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Destroyed,
                    StateUpdate::default(),
                )
                .await?;
                Ok(SyncState::Done)
            } else {
                update_sandbox_state(
                    infra,
                    sandbox.id,
                    SandboxState::Destroying,
                    StateUpdate::default(),
                )
                .await?;
                Ok(SyncState::Again)
            }
        }
    }
}
