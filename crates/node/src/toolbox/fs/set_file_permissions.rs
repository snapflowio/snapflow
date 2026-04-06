// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;

use super::types::{PermissionsQuery, validate_path};
use snapflow_errors::AppError;
use axum::{extract::Query, http::StatusCode, response::IntoResponse};

#[utoipa::path(
    post,
    path = "/files/permissions",
    tag = "file-system",
    operation_id = "setFilePermissions",
    params(PermissionsQuery),
    responses(
        (status = 200),
    )
)]
pub async fn set_file_permissions(
    Query(q): Query<PermissionsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let raw = q
        .path
        .ok_or_else(|| AppError::bad_request("path is required"))?;
    let abs = validate_path(&raw)?;

    let mode_value = if let Some(mode_str) = q.mode {
        Some(
            u32::from_str_radix(&mode_str, 8)
                .map_err(|_| AppError::bad_request("invalid mode format"))?,
        )
    } else {
        None
    };

    let owner = q.owner;
    let group = q.group;

    tokio::task::spawn_blocking(move || set_permissions_blocking(&abs, mode_value, owner, group))
        .await
        .map_err(|e| AppError::internal(e.to_string()))??;

    Ok(StatusCode::OK)
}

fn set_permissions_blocking(
    abs: &PathBuf,
    mode_value: Option<u32>,
    owner: Option<String>,
    group: Option<String>,
) -> Result<(), AppError> {
    if let Some(mode) = mode_value {
        std::fs::set_permissions(abs, std::fs::Permissions::from_mode(mode))
            .map_err(AppError::from)?;
    }

    if owner.is_some() || group.is_some() {
        let uid = match &owner {
            Some(o) => resolve_uid(o)?,
            None => u32::MAX,
        };
        let gid = match &group {
            Some(g) => resolve_gid(g)?,
            None => u32::MAX,
        };
        nix::unistd::chown(
            abs.as_path(),
            if uid == u32::MAX {
                None
            } else {
                Some(nix::unistd::Uid::from_raw(uid))
            },
            if gid == u32::MAX {
                None
            } else {
                Some(nix::unistd::Gid::from_raw(gid))
            },
        )
        .map_err(|e| AppError::bad_request(format!("failed to change ownership: {e}")))?;
    }

    Ok(())
}

fn resolve_uid(owner: &str) -> Result<u32, AppError> {
    if let Ok(uid) = owner.parse::<u32>() {
        return Ok(uid);
    }
    nix::unistd::User::from_name(owner)
        .map_err(|_| AppError::bad_request("user not found"))?
        .map(|u| u.uid.as_raw())
        .ok_or_else(|| AppError::bad_request("user not found"))
}

fn resolve_gid(group: &str) -> Result<u32, AppError> {
    if let Ok(gid) = group.parse::<u32>() {
        return Ok(gid);
    }
    nix::unistd::Group::from_name(group)
        .map_err(|_| AppError::bad_request("group not found"))?
        .map(|g| g.gid.as_raw())
        .ok_or_else(|| AppError::bad_request("group not found"))
}
