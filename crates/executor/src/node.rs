// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::{Context, Result};
use rust_embed::Embed;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use tracing::info;

#[derive(Embed)]
#[folder = "src/node/static/"]
struct NodeAssets;

const BINARY_NAME: &str = if cfg!(target_arch = "aarch64") {
    "snapflow-arm64"
} else {
    "snapflow-amd64"
};

pub fn write_static_binary() -> Result<PathBuf> {
    let binary_data = NodeAssets::get(BINARY_NAME)
        .with_context(|| format!("Embedded binary '{}' not found", BINARY_NAME))?;

    let cwd = std::env::current_dir().context("Failed to get current working directory")?;
    let tmp_binaries_dir = cwd.join(".tmp").join("binaries");
    std::fs::create_dir_all(&tmp_binaries_dir).with_context(|| {
        format!(
            "Failed to create binaries directory: {}",
            tmp_binaries_dir.display()
        )
    })?;

    let node_path = tmp_binaries_dir.join(BINARY_NAME);

    if node_path.exists() {
        std::fs::remove_file(&node_path).with_context(|| {
            format!("Failed to remove existing binary: {}", node_path.display())
        })?;
    }

    std::fs::write(&node_path, binary_data.data.as_ref())
        .with_context(|| format!("Failed to write node binary: {}", node_path.display()))?;

    std::fs::set_permissions(&node_path, std::fs::Permissions::from_mode(0o755))
        .with_context(|| format!("Failed to set permissions on: {}", node_path.display()))?;

    info!(path = %node_path.display(), "Extracted snapflow node binary");

    Ok(node_path)
}
