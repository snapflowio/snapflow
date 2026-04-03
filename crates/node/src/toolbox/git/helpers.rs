// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::io::Write;
use std::os::unix::fs::PermissionsExt;

use crate::common::errors::AppError;
use tempfile::NamedTempFile;
use tokio::process::Command;

pub async fn git(path: &str, args: &[&str]) -> Result<String, AppError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::bad_request(stderr.trim().to_string()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub async fn git_with_creds(
    path: Option<&str>,
    args: &[&str],
    username: &str,
    password: &str,
) -> Result<std::process::Output, AppError> {
    let mut helper_script =
        NamedTempFile::new().map_err(|e| AppError::bad_request(e.to_string()))?;

    writeln!(
        helper_script,
        "#!/bin/sh\necho \"username=$GIT_CRED_USERNAME\"\necho \"password=$GIT_CRED_PASSWORD\""
    )
    .map_err(|e| AppError::bad_request(e.to_string()))?;

    let helper_path = helper_script.path().to_string_lossy().to_string();

    std::fs::set_permissions(helper_script.path(), std::fs::Permissions::from_mode(0o700))
        .map_err(|e| AppError::bad_request(e.to_string()))?;

    let mut cmd = Command::new("git");

    if let Some(p) = path {
        cmd.arg("-C").arg(p);
    }

    cmd.env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_CRED_USERNAME", username)
        .env("GIT_CRED_PASSWORD", password)
        .arg("-c")
        .arg(format!("credential.helper={helper_path}"))
        .args(args);

    let output = cmd
        .output()
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?;

    drop(helper_script);

    Ok(output)
}

pub fn map_status_char(c: char) -> &'static str {
    match c {
        ' ' => "Unmodified",
        '?' => "Untracked",
        'M' => "Modified",
        'A' => "Added",
        'D' => "Deleted",
        'R' => "Renamed",
        'C' => "Copied",
        'U' => "Updated but unmerged",
        _ => "Unmodified",
    }
}
