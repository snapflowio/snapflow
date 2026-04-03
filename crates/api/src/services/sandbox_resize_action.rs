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
use snapflow_models::{ExecutorState, SandboxState};

use super::sandbox_actions::{StateUpdate, SyncState, update_sandbox_state};

pub async fn run(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    match sandbox.state {
        SandboxState::Started => handle_resize(infra, sandbox).await,
        SandboxState::Resizing => handle_resizing_check(infra, sandbox).await,
        _ => Ok(SyncState::Done),
    }
}

async fn handle_resize(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        update_sandbox_state(
            infra,
            sandbox.id,
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("sandbox has no executor assigned"),
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
            SandboxState::Error,
            StateUpdate {
                error_reason: Some("executor not found"),
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

    update_sandbox_state(
        infra,
        sandbox.id,
        SandboxState::Resizing,
        StateUpdate::default(),
    )
    .await?;

    match adapter
        .resize_sandbox(&sandbox.id.to_string(), sandbox.cpu, sandbox.mem)
        .await
    {
        Ok(()) => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Started,
                StateUpdate::default(),
            )
            .await?;
            Ok(SyncState::Done)
        }
        Err(e) => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Error,
                StateUpdate {
                    error_reason: Some(&format!("resize failed: {e}")),
                    ..Default::default()
                },
            )
            .await?;
            Ok(SyncState::Done)
        }
    }
}

async fn handle_resizing_check(infra: &Infra, sandbox: &Sandbox) -> Result<SyncState> {
    let Some(executor_id) = sandbox.executor_id else {
        return Ok(SyncState::Done);
    };

    let Some(exec) = repositories::executor::find_by_id(&infra.pool, executor_id).await? else {
        return Ok(SyncState::Done);
    };

    let adapter = executor::create_adapter(&exec)?;
    let info = adapter.sandbox_info(&sandbox.id.to_string()).await?;

    match info.state {
        SandboxState::Started => {
            update_sandbox_state(
                infra,
                sandbox.id,
                SandboxState::Started,
                StateUpdate::default(),
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
                    error_reason: Some("sandbox entered error state during resize"),
                    ..Default::default()
                },
            )
            .await?;
            Ok(SyncState::Done)
        }
        _ => Ok(SyncState::Again),
    }
}
