// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use super::{ComputerManager, display, keyboard, mouse, screenshot};
use crate::common::errors::AppError;
use crate::toolbox::AppState;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use utoipa::{IntoParams, ToSchema};

#[derive(Serialize, ToSchema)]
pub struct ComputerStatusResponse {
    pub status: String,
}

#[derive(Serialize, ToSchema)]
pub struct ComputerStartResponse {
    pub message: String,
    pub status: HashMap<String, super::ProcessStatus>,
}

#[derive(Serialize, ToSchema)]
pub struct ComputerStopResponse {
    pub message: String,
    pub status: HashMap<String, super::ProcessStatus>,
}

#[derive(Serialize, ToSchema)]
pub struct ProcessStatusResponse {
    pub status: HashMap<String, super::ProcessStatus>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SingleProcessStatusResponse {
    pub process_name: String,
    pub running: bool,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProcessRestartResponse {
    pub message: String,
    pub process_name: String,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProcessLogsResponse {
    pub process_name: String,
    pub logs: String,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProcessErrorsResponse {
    pub process_name: String,
    pub errors: String,
}

pub async fn shutdown_computer(manager: &ComputerManager) {
    let _ = manager.stop().await;
}

fn get_computer(state: &AppState) -> Result<&Arc<ComputerManager>, AppError> {
    state
        .computer
        .as_ref()
        .ok_or_else(|| AppError::service_unavailable("computer features not available"))
}

pub fn router() -> Router<Arc<AppState>> {
    Router::default()
        .route("/status", get(get_status))
        .route("/start", post(start_computer))
        .route("/stop", post(stop_computer))
        .route("/process-status", get(get_process_status))
        .route(
            "/process/{processName}/status",
            get(get_single_process_status),
        )
        .route("/process/{processName}/restart", post(restart_process))
        .route("/process/{processName}/logs", get(get_process_logs))
        .route("/process/{processName}/errors", get(get_process_errors))
        .route("/screenshot", get(get_screenshot))
        .route("/screenshot/region", get(get_region_screenshot))
        .route("/screenshot/compressed", get(get_compressed_screenshot))
        .route(
            "/screenshot/region/compressed",
            get(get_compressed_region_screenshot),
        )
        .route("/mouse/position", get(get_mouse_position))
        .route("/mouse/move", post(move_mouse))
        .route("/mouse/click", post(click_mouse))
        .route("/mouse/drag", post(drag_mouse))
        .route("/mouse/scroll", post(scroll_mouse))
        .route("/keyboard/type", post(type_text))
        .route("/keyboard/key", post(press_key))
        .route("/keyboard/hotkey", post(press_hotkey))
        .route("/display/info", get(get_display_info))
        .route("/display/windows", get(get_windows))
}

#[utoipa::path(
    get,
    path = "/computer/status",
    tag = "computer-use",
    operation_id = "getComputerStatus",
    responses(
        (status = 200, body = ComputerStatusResponse),
    )
)]
pub async fn get_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ComputerStatusResponse>, AppError> {
    let computer = get_computer(&state)?;
    let status = computer.get_overall_status().await;
    Ok(Json(ComputerStatusResponse {
        status: status.to_owned(),
    }))
}

#[utoipa::path(
    post,
    path = "/computer/start",
    tag = "computer-use",
    operation_id = "startComputer",
    responses(
        (status = 200, body = ComputerStartResponse),
    )
)]
pub async fn start_computer(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ComputerStartResponse>, AppError> {
    let computer = get_computer(&state)?;
    computer
        .start()
        .await
        .map_err(|e| AppError::service_unavailable(format!("Failed to start computer: {e}")))?;

    let status = computer.get_process_status().await;
    Ok(Json(ComputerStartResponse {
        message: "Computer processes started successfully".into(),
        status,
    }))
}

#[utoipa::path(
    post,
    path = "/computer/stop",
    tag = "computer-use",
    operation_id = "stopComputer",
    responses(
        (status = 200, body = ComputerStopResponse),
    )
)]
pub async fn stop_computer(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ComputerStopResponse>, AppError> {
    let computer = get_computer(&state)?;
    computer
        .stop()
        .await
        .map_err(|e| AppError::service_unavailable(format!("Failed to stop computer: {e}")))?;

    let status = computer.get_process_status().await;
    Ok(Json(ComputerStopResponse {
        message: "Computer processes stopped successfully".into(),
        status,
    }))
}

#[utoipa::path(
    get,
    path = "/computer/process-status",
    tag = "computer-use",
    operation_id = "getProcessStatus",
    responses(
        (status = 200, body = ProcessStatusResponse),
    )
)]
pub async fn get_process_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ProcessStatusResponse>, AppError> {
    let computer = get_computer(&state)?;
    let status = computer.get_process_status().await;
    Ok(Json(ProcessStatusResponse { status }))
}

#[utoipa::path(
    get,
    path = "/computer/process/{processName}/status",
    tag = "computer-use",
    operation_id = "getSingleProcessStatus",
    params(
        ("processName" = String, Path,),
    ),
    responses(
        (status = 200, body = SingleProcessStatusResponse),
    )
)]
pub async fn get_single_process_status(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<SingleProcessStatusResponse>, AppError> {
    let computer = get_computer(&state)?;
    let running = computer
        .is_process_running(&name)
        .await
        .ok_or_else(|| AppError::bad_request("process not found"))?;
    Ok(Json(SingleProcessStatusResponse {
        process_name: name,
        running,
    }))
}

#[utoipa::path(
    post,
    path = "/computer/process/{processName}/restart",
    tag = "computer-use",
    operation_id = "restartProcess",
    params(
        ("processName" = String, Path,),
    ),
    responses(
        (status = 200, body = ProcessRestartResponse),
    )
)]
pub async fn restart_process(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<ProcessRestartResponse>, AppError> {
    let computer = get_computer(&state)?;
    computer
        .restart_process(&name)
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(ProcessRestartResponse {
        message: format!("Process {name} restarted successfully"),
        process_name: name,
    }))
}

#[utoipa::path(
    get,
    path = "/computer/process/{processName}/logs",
    tag = "computer-use",
    operation_id = "getProcessLogs",
    params(
        ("processName" = String, Path,),
    ),
    responses(
        (status = 200, body = ProcessLogsResponse),
    )
)]
pub async fn get_process_logs(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<ProcessLogsResponse>, AppError> {
    let computer = get_computer(&state)?;
    let logs = computer
        .get_process_logs(&name)
        .await
        .ok_or_else(|| AppError::bad_request("process not found"))?;
    Ok(Json(ProcessLogsResponse {
        process_name: name,
        logs,
    }))
}

#[utoipa::path(
    get,
    path = "/computer/process/{processName}/errors",
    tag = "computer-use",
    operation_id = "getProcessErrors",
    params(
        ("processName" = String, Path,),
    ),
    responses(
        (status = 200, body = ProcessErrorsResponse),
    )
)]
pub async fn get_process_errors(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<ProcessErrorsResponse>, AppError> {
    let computer = get_computer(&state)?;
    let errors = computer
        .get_process_errors(&name)
        .await
        .ok_or_else(|| AppError::bad_request("process not found"))?;
    Ok(Json(ProcessErrorsResponse {
        process_name: name,
        errors,
    }))
}

#[derive(Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScreenshotQuery {
    #[serde(default)]
    show_cursor: Option<String>,
}

#[derive(Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RegionQuery {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    #[serde(default)]
    show_cursor: Option<String>,
}

#[derive(Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompressedQuery {
    #[serde(default)]
    format: Option<String>,
    #[serde(default)]
    quality: Option<u8>,
    #[serde(default)]
    scale: Option<f64>,
    #[serde(default)]
    show_cursor: Option<String>,
}

#[derive(Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompressedRegionQuery {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    #[serde(default)]
    format: Option<String>,
    #[serde(default)]
    quality: Option<u8>,
    #[serde(default)]
    scale: Option<f64>,
    #[serde(default)]
    show_cursor: Option<String>,
}

#[utoipa::path(
    get,
    path = "/computer/screenshot",
    tag = "computer-use",
    operation_id = "getScreenshot",
    params(ScreenshotQuery),
    responses(
        (status = 200, body = screenshot::ScreenshotResponse),
    )
)]
pub async fn get_screenshot(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ScreenshotQuery>,
) -> Result<Json<screenshot::ScreenshotResponse>, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    let show = q.show_cursor.as_deref() == Some("true");
    let resp = tokio::task::spawn_blocking(move || screenshot::take_screenshot(&display, show))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}

#[utoipa::path(
    get,
    path = "/computer/screenshot/region",
    tag = "computer-use",
    operation_id = "getRegionScreenshot",
    params(RegionQuery),
    responses(
        (status = 200, body = screenshot::ScreenshotResponse),
    )
)]
pub async fn get_region_screenshot(
    State(state): State<Arc<AppState>>,
    Query(q): Query<RegionQuery>,
) -> Result<Json<screenshot::ScreenshotResponse>, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    let show = q.show_cursor.as_deref() == Some("true");
    let resp = tokio::task::spawn_blocking(move || {
        screenshot::take_region_screenshot(&display, q.x, q.y, q.width, q.height, show)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
    .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}

#[utoipa::path(
    get,
    path = "/computer/screenshot/compressed",
    tag = "computer-use",
    operation_id = "getCompressedScreenshot",
    params(CompressedQuery),
    responses(
        (status = 200, body = screenshot::ScreenshotResponse),
    )
)]
pub async fn get_compressed_screenshot(
    State(state): State<Arc<AppState>>,
    Query(q): Query<CompressedQuery>,
) -> Result<Json<screenshot::ScreenshotResponse>, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    let show = q.show_cursor.as_deref() == Some("true");
    let format = q.format.unwrap_or_else(|| "png".into());
    let quality = q.quality.unwrap_or(85);
    let scale = q.scale.unwrap_or(1.0).clamp(0.1, 1.0);

    let resp = tokio::task::spawn_blocking(move || {
        screenshot::take_compressed_screenshot(&display, &format, quality, scale, show)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
    .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}

#[utoipa::path(
    get,
    path = "/computer/screenshot/region/compressed",
    tag = "computer-use",
    operation_id = "getCompressedRegionScreenshot",
    params(CompressedRegionQuery),
    responses(
        (status = 200, body = screenshot::ScreenshotResponse),
    )
)]
pub async fn get_compressed_region_screenshot(
    State(state): State<Arc<AppState>>,
    Query(q): Query<CompressedRegionQuery>,
) -> Result<Json<screenshot::ScreenshotResponse>, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    let show = q.show_cursor.as_deref() == Some("true");
    let format = q.format.unwrap_or_else(|| "png".into());
    let quality = q.quality.unwrap_or(85);
    let scale = q.scale.unwrap_or(1.0).clamp(0.1, 1.0);

    let resp = tokio::task::spawn_blocking(move || {
        screenshot::compress_region_screenshot(
            &display, q.x, q.y, q.width, q.height, &format, quality, scale, show,
        )
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
    .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}

#[utoipa::path(
    get,
    path = "/computer/mouse/position",
    tag = "computer-use",
    operation_id = "getMousePosition",
    responses(
        (status = 200, body = mouse::PositionResponse),
    )
)]
pub async fn get_mouse_position(
    State(state): State<Arc<AppState>>,
) -> Result<Json<mouse::PositionResponse>, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    let (x, y) = tokio::task::spawn_blocking(move || mouse::get_position(&display))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(mouse::PositionResponse { x, y }))
}

#[utoipa::path(
    post,
    path = "/computer/mouse/move",
    tag = "computer-use",
    operation_id = "moveMouse",
    request_body = mouse::MoveRequest,
    responses(
        (status = 200, body = mouse::PositionResponse),
    )
)]
pub async fn move_mouse(
    State(state): State<Arc<AppState>>,
    Json(req): Json<mouse::MoveRequest>,
) -> Result<Json<mouse::PositionResponse>, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    let resp = tokio::task::spawn_blocking(move || mouse::move_mouse(req.x, req.y, &display))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}

#[utoipa::path(
    post,
    path = "/computer/mouse/click",
    tag = "computer-use",
    operation_id = "clickMouse",
    request_body = mouse::ClickRequest,
    responses(
        (status = 200, body = mouse::PositionResponse),
    )
)]
pub async fn click_mouse(
    State(state): State<Arc<AppState>>,
    Json(req): Json<mouse::ClickRequest>,
) -> Result<Json<mouse::PositionResponse>, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    let resp = tokio::task::spawn_blocking(move || mouse::click(&req, &display))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}

#[utoipa::path(
    post,
    path = "/computer/mouse/drag",
    tag = "computer-use",
    operation_id = "dragMouse",
    request_body = mouse::DragRequest,
    responses(
        (status = 200, body = mouse::PositionResponse),
    )
)]
pub async fn drag_mouse(
    State(state): State<Arc<AppState>>,
    Json(req): Json<mouse::DragRequest>,
) -> Result<Json<mouse::PositionResponse>, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    let resp = tokio::task::spawn_blocking(move || mouse::drag(&req, &display))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}

#[utoipa::path(
    post,
    path = "/computer/mouse/scroll",
    tag = "computer-use",
    operation_id = "scrollMouse",
    request_body = mouse::ScrollRequest,
    responses(
        (status = 200, body = mouse::ScrollResponse),
    )
)]
pub async fn scroll_mouse(
    State(state): State<Arc<AppState>>,
    Json(req): Json<mouse::ScrollRequest>,
) -> Result<Json<mouse::ScrollResponse>, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    let resp = tokio::task::spawn_blocking(move || mouse::scroll(&req, &display))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}

#[utoipa::path(
    post,
    path = "/computer/keyboard/type",
    tag = "computer-use",
    operation_id = "typeText",
    request_body = keyboard::TypeTextRequest,
    responses(
        (status = 200),
    )
)]
pub async fn type_text(
    State(state): State<Arc<AppState>>,
    Json(req): Json<keyboard::TypeTextRequest>,
) -> Result<StatusCode, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    tokio::task::spawn_blocking(move || keyboard::type_text(&req, &display))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/computer/keyboard/key",
    tag = "computer-use",
    operation_id = "pressKey",
    request_body = keyboard::PressKeyRequest,
    responses(
        (status = 200),
    )
)]
pub async fn press_key(
    State(state): State<Arc<AppState>>,
    Json(req): Json<keyboard::PressKeyRequest>,
) -> Result<StatusCode, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    tokio::task::spawn_blocking(move || keyboard::press_key(&req, &display))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(StatusCode::OK)
}

#[utoipa::path(
    post,
    path = "/computer/keyboard/hotkey",
    tag = "computer-use",
    operation_id = "pressHotkey",
    request_body = keyboard::PressHotkeyRequest,
    responses(
        (status = 200),
    )
)]
pub async fn press_hotkey(
    State(state): State<Arc<AppState>>,
    Json(req): Json<keyboard::PressHotkeyRequest>,
) -> Result<StatusCode, AppError> {
    let computer = get_computer(&state)?;
    let display = computer.display().to_string();
    tokio::task::spawn_blocking(move || keyboard::press_hotkey(&req.keys, &display))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/computer/display/info",
    tag = "computer-use",
    operation_id = "getDisplayInfo",
    responses(
        (status = 200, body = display::DisplayInfoResponse),
    )
)]
pub async fn get_display_info(
    State(state): State<Arc<AppState>>,
) -> Result<Json<display::DisplayInfoResponse>, AppError> {
    let computer = get_computer(&state)?;
    let disp = computer.display().to_string();
    let resp = tokio::task::spawn_blocking(move || display::get_display_info(&disp))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}

#[utoipa::path(
    get,
    path = "/computer/display/windows",
    tag = "computer-use",
    operation_id = "getWindows",
    responses(
        (status = 200, body = display::WindowsResponse),
    )
)]
pub async fn get_windows(
    State(state): State<Arc<AppState>>,
) -> Result<Json<display::WindowsResponse>, AppError> {
    let computer = get_computer(&state)?;
    let disp = computer.display().to_string();
    let resp = tokio::task::spawn_blocking(move || display::get_windows(&disp))
        .await
        .map_err(|e| AppError::internal(e.to_string()))?
        .map_err(|e| AppError::bad_request(e.to_string()))?;
    Ok(Json(resp))
}
