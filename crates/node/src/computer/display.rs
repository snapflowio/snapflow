// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::Serialize;
use std::process::Command;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
pub struct DisplayInfoResponse {
    pub displays: Vec<DisplayInfo>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub id: u32,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_active: bool,
}

#[derive(Serialize, ToSchema)]
pub struct WindowsResponse {
    pub windows: Vec<WindowInfo>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub id: u32,
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_active: bool,
}

pub fn get_display_info(display: &str) -> anyhow::Result<DisplayInfoResponse> {
    let output = Command::new("xdpyinfo").env("DISPLAY", display).output()?;

    if !output.status.success() {
        anyhow::bail!("xdpyinfo failed");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut width: u32 = 0;
    let mut height: u32 = 0;

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("dimensions:") {
            if let Some(dims) = trimmed.split_whitespace().nth(1)
                && let Some((w, h)) = dims.split_once('x')
            {
                width = w.parse().unwrap_or(0);
                height = h.parse().unwrap_or(0);
            }
            break;
        }
    }

    Ok(DisplayInfoResponse {
        displays: vec![DisplayInfo {
            id: 0,
            x: 0,
            y: 0,
            width,
            height,
            is_active: true,
        }],
    })
}

pub fn get_windows(display: &str) -> anyhow::Result<WindowsResponse> {
    let active_output = Command::new("xdotool")
        .args(["getactivewindow"])
        .env("DISPLAY", display)
        .output();
    let active_id: Option<u32> = active_output
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse().ok());

    let output = Command::new("xdotool")
        .args(["search", "--onlyvisible", "--name", ""])
        .env("DISPLAY", display)
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut windows = Vec::default();

    for line in stdout.lines() {
        let wid: u32 = match line.trim().parse() {
            Ok(id) => id,
            Err(_) => continue,
        };

        let name_out = Command::new("xdotool")
            .args(["getwindowname", &wid.to_string()])
            .env("DISPLAY", display)
            .output();
        let title = name_out
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let geo_out = Command::new("xdotool")
            .args(["getwindowgeometry", "--shell", &wid.to_string()])
            .env("DISPLAY", display)
            .output();
        let (mut x, mut y, mut w, mut h) = (0i32, 0i32, 0u32, 0u32);
        if let Ok(geo) = geo_out {
            let geo_str = String::from_utf8_lossy(&geo.stdout);
            for gline in geo_str.lines() {
                if let Some(val) = gline.strip_prefix("X=") {
                    x = val.parse().unwrap_or(0);
                } else if let Some(val) = gline.strip_prefix("Y=") {
                    y = val.parse().unwrap_or(0);
                } else if let Some(val) = gline.strip_prefix("WIDTH=") {
                    w = val.parse().unwrap_or(0);
                } else if let Some(val) = gline.strip_prefix("HEIGHT=") {
                    h = val.parse().unwrap_or(0);
                }
            }
        }

        windows.push(WindowInfo {
            id: wid,
            title,
            x,
            y,
            width: w,
            height: h,
            is_active: active_id == Some(wid),
        });
    }

    Ok(WindowsResponse { windows })
}
