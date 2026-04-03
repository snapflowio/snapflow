// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use serde::{Deserialize, Serialize};
use std::process::Command;
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct MoveRequest {
    pub x: i32,
    pub y: i32,
}

#[derive(Deserialize, ToSchema)]
pub struct ClickRequest {
    pub x: i32,
    pub y: i32,
    #[serde(default)]
    pub button: Option<String>,
    #[serde(default)]
    pub double: bool,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DragRequest {
    pub start_x: i32,
    pub start_y: i32,
    pub end_x: i32,
    pub end_y: i32,
    #[serde(default)]
    pub button: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct ScrollRequest {
    pub x: i32,
    pub y: i32,
    pub direction: String,
    pub amount: i32,
}

#[derive(Serialize, ToSchema)]
pub struct PositionResponse {
    pub x: i32,
    pub y: i32,
}

#[derive(Serialize, ToSchema)]
pub struct ScrollResponse {
    pub success: bool,
}

fn xdotool(args: &[&str], display: &str) -> anyhow::Result<String> {
    let output = Command::new("xdotool")
        .args(args)
        .env("DISPLAY", display)
        .output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("xdotool failed: {stderr}");
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn button_num(s: Option<&str>) -> &'static str {
    match s {
        Some("right") => "3",
        Some("middle") => "2",
        _ => "1",
    }
}

pub fn get_position(display: &str) -> anyhow::Result<(i32, i32)> {
    let output = xdotool(&["getmouselocation", "--shell"], display)?;
    let mut x = 0i32;
    let mut y = 0i32;
    for line in output.lines() {
        if let Some(val) = line.strip_prefix("X=") {
            x = val.parse().unwrap_or(0);
        } else if let Some(val) = line.strip_prefix("Y=") {
            y = val.parse().unwrap_or(0);
        }
    }
    Ok((x, y))
}

pub fn move_mouse(x: i32, y: i32, display: &str) -> anyhow::Result<PositionResponse> {
    xdotool(&["mousemove", &x.to_string(), &y.to_string()], display)?;
    Ok(PositionResponse { x, y })
}

pub fn click(req: &ClickRequest, display: &str) -> anyhow::Result<PositionResponse> {
    xdotool(
        &["mousemove", &req.x.to_string(), &req.y.to_string()],
        display,
    )?;
    let btn = button_num(req.button.as_deref());
    if req.double {
        xdotool(&["click", "--repeat", "2", "--delay", "50", btn], display)?;
    } else {
        xdotool(&["click", btn], display)?;
    }
    Ok(PositionResponse { x: req.x, y: req.y })
}

pub fn drag(req: &DragRequest, display: &str) -> anyhow::Result<PositionResponse> {
    let btn = button_num(req.button.as_deref());
    xdotool(
        &[
            "mousemove",
            &req.start_x.to_string(),
            &req.start_y.to_string(),
        ],
        display,
    )?;
    xdotool(&["mousedown", btn], display)?;

    let steps = 20;
    for i in 1..=steps {
        let x = req.start_x + (req.end_x - req.start_x) * i / steps;
        let y = req.start_y + (req.end_y - req.start_y) * i / steps;
        xdotool(&["mousemove", &x.to_string(), &y.to_string()], display)?;
        std::thread::sleep(std::time::Duration::from_millis(10));
    }

    xdotool(&["mouseup", btn], display)?;
    Ok(PositionResponse {
        x: req.end_x,
        y: req.end_y,
    })
}

pub fn scroll(req: &ScrollRequest, display: &str) -> anyhow::Result<ScrollResponse> {
    xdotool(
        &["mousemove", &req.x.to_string(), &req.y.to_string()],
        display,
    )?;
    let btn = match req.direction.as_str() {
        "up" => "4",
        "down" => "5",
        _ => "4",
    };
    for _ in 0..req.amount {
        xdotool(&["click", btn], display)?;
    }
    Ok(ScrollResponse { success: true })
}
