// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Deserialize;
use std::process::Command;
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct TypeTextRequest {
    pub text: String,
    #[serde(default)]
    pub delay: Option<u64>,
}

#[derive(Deserialize, ToSchema)]
pub struct PressKeyRequest {
    pub key: String,
    #[serde(default)]
    pub modifiers: Option<Vec<String>>,
}

#[derive(Deserialize, ToSchema)]
pub struct PressHotkeyRequest {
    pub keys: String,
}

fn xdotool(args: &[&str], display: &str) -> anyhow::Result<()> {
    let output = Command::new("xdotool")
        .args(args)
        .env("DISPLAY", display)
        .output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("xdotool failed: {stderr}");
    }
    Ok(())
}

pub fn type_text(req: &TypeTextRequest, display: &str) -> anyhow::Result<()> {
    let delay = req.delay.unwrap_or(12).to_string();
    xdotool(&["type", "--delay", &delay, &req.text], display)
}

pub fn press_key(req: &PressKeyRequest, display: &str) -> anyhow::Result<()> {
    let key_combo = if let Some(modifiers) = &req.modifiers {
        let mut parts: Vec<&str> = modifiers.iter().map(String::as_str).collect();
        parts.push(&req.key);
        parts.join("+")
    } else {
        req.key.clone()
    };
    xdotool(&["key", &key_combo], display)
}

pub fn press_hotkey(keys_str: &str, display: &str) -> anyhow::Result<()> {
    xdotool(&["key", keys_str], display)
}
