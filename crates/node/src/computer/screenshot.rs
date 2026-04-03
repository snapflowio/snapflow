// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use base64::Engine;
use serde::Serialize;
use std::process::Command;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotResponse {
    pub screenshot: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor_position: Option<CursorPos>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<usize>,
}

#[derive(Serialize, ToSchema)]
pub struct CursorPos {
    pub x: i32,
    pub y: i32,
}

pub fn take_screenshot(display: &str, show_cursor: bool) -> anyhow::Result<ScreenshotResponse> {
    let tmp = tempfile::NamedTempFile::new()?;
    let path = tmp.path().to_string_lossy().to_string();

    let status = Command::new("scrot")
        .args(["-o", "-z", &path])
        .env("DISPLAY", display)
        .status()?;

    if !status.success() {
        anyhow::bail!("scrot failed with exit code {:?}", status.code());
    }

    let png = std::fs::read(&path)?;

    let cursor_position = if show_cursor {
        super::mouse::get_position(display)
            .ok()
            .map(|(x, y)| CursorPos { x, y })
    } else {
        None
    };

    Ok(ScreenshotResponse {
        size_bytes: Some(png.len()),
        screenshot: base64::engine::general_purpose::STANDARD.encode(&png),
        cursor_position,
    })
}

pub fn take_region_screenshot(
    display: &str,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    show_cursor: bool,
) -> anyhow::Result<ScreenshotResponse> {
    let tmp = tempfile::NamedTempFile::new()?;
    let path = tmp.path().to_string_lossy().to_string();
    let area = format!("{x},{y},{width},{height}");

    let status = Command::new("scrot")
        .args(["-o", "-z", "-a", &area, &path])
        .env("DISPLAY", display)
        .status()?;

    if !status.success() {
        anyhow::bail!("scrot region capture failed");
    }

    let png = std::fs::read(&path)?;

    let cursor_position = if show_cursor {
        super::mouse::get_position(display)
            .ok()
            .map(|(x, y)| CursorPos { x, y })
    } else {
        None
    };

    Ok(ScreenshotResponse {
        size_bytes: Some(png.len()),
        screenshot: base64::engine::general_purpose::STANDARD.encode(&png),
        cursor_position,
    })
}

pub fn take_compressed_screenshot(
    display: &str,
    format: &str,
    quality: u8,
    scale: f64,
    show_cursor: bool,
) -> anyhow::Result<ScreenshotResponse> {
    let tmp = tempfile::NamedTempFile::new()?;
    let path = tmp.path().to_string_lossy().to_string();

    let mut args = vec!["-o", "-z"];
    let quality_str = quality.to_string();
    if format == "jpeg" || format == "jpg" {
        args.extend(["--quality", &quality_str]);
    }
    args.push(&path);

    let status = Command::new("scrot")
        .args(&args)
        .env("DISPLAY", display)
        .status()?;

    if !status.success() {
        anyhow::bail!("scrot failed");
    }

    compress_image_file(
        &path,
        format,
        quality,
        &quality_str,
        scale,
        display,
        show_cursor,
    )
}

pub fn compress_region_screenshot(
    display: &str,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    format: &str,
    quality: u8,
    scale: f64,
    show_cursor: bool,
) -> anyhow::Result<ScreenshotResponse> {
    let tmp = tempfile::NamedTempFile::new()?;
    let path = tmp.path().to_string_lossy().to_string();
    let area = format!("{x},{y},{width},{height}");

    let mut args = vec!["-o", "-z", "-a", area.as_str()];
    let quality_str = quality.to_string();
    if format == "jpeg" || format == "jpg" {
        args.extend(["--quality", &quality_str]);
    }
    args.push(&path);

    let status = Command::new("scrot")
        .args(&args)
        .env("DISPLAY", display)
        .status()?;

    if !status.success() {
        anyhow::bail!("scrot region capture failed");
    }

    compress_image_file(
        &path,
        format,
        quality,
        &quality_str,
        scale,
        display,
        show_cursor,
    )
}

fn compress_image_file(
    path: &str,
    format: &str,
    _quality: u8,
    quality_str: &str,
    scale: f64,
    display: &str,
    show_cursor: bool,
) -> anyhow::Result<ScreenshotResponse> {
    if (scale - 1.0).abs() > 0.01 {
        let pct = format!("{}%", (scale * 100.0) as u32);
        let status = Command::new("convert")
            .args([path, "-resize", &pct, path])
            .status()?;
        if !status.success() {
            anyhow::bail!("convert resize failed with exit code {:?}", status.code());
        }
    }

    if format == "jpeg" || format == "jpg" {
        let jpeg_path = format!("{path}.jpg");
        let status = Command::new("convert")
            .args([path, "-quality", quality_str, &jpeg_path])
            .status()?;
        if !status.success() {
            anyhow::bail!(
                "convert jpeg compression failed with exit code {:?}",
                status.code()
            );
        }
        if std::path::Path::new(&jpeg_path).exists() {
            let data = std::fs::read(&jpeg_path)?;
            let _ = std::fs::remove_file(&jpeg_path);
            let cursor_position = if show_cursor {
                super::mouse::get_position(display)
                    .ok()
                    .map(|(x, y)| CursorPos { x, y })
            } else {
                None
            };
            return Ok(ScreenshotResponse {
                size_bytes: Some(data.len()),
                screenshot: base64::engine::general_purpose::STANDARD.encode(&data),
                cursor_position,
            });
        }
    }

    let data = std::fs::read(path)?;
    let cursor_position = if show_cursor {
        super::mouse::get_position(display)
            .ok()
            .map(|(x, y)| CursorPos { x, y })
    } else {
        None
    };

    Ok(ScreenshotResponse {
        size_bytes: Some(data.len()),
        screenshot: base64::engine::general_purpose::STANDARD.encode(&data),
        cursor_position,
    })
}
