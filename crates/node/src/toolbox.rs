// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod fs;
pub mod git;
pub mod lsp;
pub mod network;
pub mod port;
pub mod process;
pub mod proxy;
pub mod session;

use axum::{
    Router,
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
};
use std::sync::Arc;

use crate::computer::{ComputerError, ComputerManager, ComputerSolution, detect_error};
use crate::network::store::NetworkEventBroadcast;
use crate::toolbox::lsp::LspServers;
use crate::toolbox::port::PortDetector;
use crate::toolbox::process::pty::PtyManager;
use crate::toolbox::session::SessionController;

pub struct AppState {
    pub sessions: SessionController,
    pub pty_manager: Arc<PtyManager>,
    pub port_detector: Arc<PortDetector>,
    pub lsp_servers: LspServers,
    pub computer: Option<Arc<ComputerManager>>,
    pub network_broadcast: Option<Arc<NetworkEventBroadcast>>,
    pub project_dir: String,
}

pub fn router(state: Arc<AppState>, computer_available: bool) -> Router {
    let files = Router::default()
        .route("/", get(fs::list_files))
        .route("/download", get(fs::download_file))
        .route("/bulk-download", post(fs::bulk_download))
        .route("/find", get(fs::find_in_files))
        .route("/info", get(fs::get_file_info))
        .route("/search", get(fs::search_files))
        .route("/folder", post(fs::create_folder))
        .route("/move", post(fs::move_file))
        .route("/permissions", post(fs::set_file_permissions))
        .route("/replace", post(fs::replace_in_files))
        .route("/upload", post(fs::upload_file))
        .route("/bulk-upload", post(fs::bulk_upload))
        .route("/", delete(fs::delete_file));

    let process_routes = Router::default()
        .route("/execute", post(process::execute_command))
        .route("/code-run", post(process::run_code));

    let pty_routes = Router::default()
        .route(
            "/",
            get(process::pty::list_pty_sessions).post(process::pty::create_pty_session),
        )
        .route(
            "/{sessionId}",
            get(process::pty::get_pty_session).delete(process::pty::delete_pty_session),
        )
        .route(
            "/{sessionId}/resize",
            post(process::pty::resize_pty_session),
        )
        .route(
            "/{sessionId}/connect",
            get(process::pty::connect_pty_session),
        );

    let session_routes = Router::default()
        .route(
            "/",
            get(session::list_sessions).post(session::create_session),
        )
        .route(
            "/{sessionId}",
            get(session::get_session).delete(session::delete_session),
        )
        .route("/{sessionId}/exec", post(session::execute_command))
        .route(
            "/{sessionId}/command/{commandId}",
            get(session::get_command),
        )
        .route(
            "/{sessionId}/command/{commandId}/logs",
            get(session::get_command_logs),
        );

    let git_routes = Router::default()
        .route(
            "/branches",
            get(git::list_branches)
                .post(git::create_branch)
                .delete(git::delete_branch),
        )
        .route("/history", get(git::get_history))
        .route("/status", get(git::get_status))
        .route("/add", post(git::add_files))
        .route("/checkout", post(git::checkout))
        .route("/clone", post(git::clone_repo))
        .route("/commit", post(git::commit))
        .route("/pull", post(git::pull))
        .route("/push", post(git::push));

    let lsp_routes = Router::default()
        .route("/start", post(lsp::start))
        .route("/stop", post(lsp::stop))
        .route("/completions", post(lsp::completions))
        .route("/did-open", post(lsp::did_open))
        .route("/did-close", post(lsp::did_close))
        .route("/document-symbols", get(lsp::document_symbols))
        .route("/workspacesymbols", get(lsp::workspace_symbols));

    let port_routes = Router::default()
        .route("/", get(port::get_ports))
        .route("/{port}/in-use", get(port::is_port_in_use));

    let network_routes = Router::default()
        .route("/events", get(network::get_events))
        .route("/stream", get(network::stream_events));

    let proxy_routes =
        Router::default().route("/{*path}", axum::routing::any(proxy::proxy_handler));

    let computer_routes = if computer_available {
        crate::computer::routes::router()
    } else {
        computer_disabled_router()
    };

    Router::default()
        .route("/version", get(get_version))
        .route("/project-dir", get(get_project_dir))
        .route("/work-dir", get(get_work_dir))
        .route("/user-home-dir", get(get_user_home_dir))
        .nest("/files", files)
        .nest("/process", process_routes)
        .nest("/process/session", session_routes)
        .nest("/process/pty", pty_routes)
        .nest("/git", git_routes)
        .nest("/lsp", lsp_routes)
        .nest("/network", network_routes)
        .nest("/port", port_routes)
        .nest("/proxy", proxy_routes)
        .nest("/computer", computer_routes)
        .with_state(state)
}

#[utoipa::path(
    get,
    path = "/version",
    tag = "info",
    operation_id = "getVersion",
    responses(
        (status = 200),
    )
)]
pub async fn get_version() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "version": env!("CARGO_PKG_VERSION")
    }))
}

#[utoipa::path(
    get,
    path = "/work-dir",
    tag = "info",
    operation_id = "getWorkDir",
    responses(
        (status = 200),
    )
)]
pub async fn get_work_dir() -> Result<axum::Json<serde_json::Value>, (StatusCode, String)> {
    let dir =
        std::env::current_dir().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(axum::Json(serde_json::json!({
        "dir": dir.to_string_lossy()
    })))
}

#[utoipa::path(
    get,
    path = "/project-dir",
    tag = "info",
    operation_id = "getProjectDir",
    responses(
        (status = 200),
    )
)]
pub async fn get_project_dir(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "dir": state.project_dir
    }))
}

#[utoipa::path(
    get,
    path = "/user-home-dir",
    tag = "info",
    operation_id = "getUserHomeDir",
    responses(
        (status = 200),
    )
)]
pub async fn get_user_home_dir() -> Result<axum::Json<serde_json::Value>, (StatusCode, String)> {
    let dir = std::env::var("HOME").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "could not determine home directory".to_string(),
        )
    })?;
    Ok(axum::Json(serde_json::json!({
        "dir": dir
    })))
}

fn computer_disabled_router() -> Router<Arc<AppState>> {
    async fn disabled() -> impl IntoResponse {
        let error = detect_error().unwrap_or_else(|| ComputerError {
            error_type: "unknown".into(),
            message: "Computer functionality is not available".into(),
            details: "The computer module failed to initialize due to missing dependencies in the runtime environment.".into(),
            solution: Some(ComputerSolution {
                ubuntu: "sudo apt-get install -y xdotool scrot x11-utils".into(),
                fedora: "sudo dnf install -y xdotool scrot xorg-x11-utils".into(),
                alpine: "apk add --no-cache xdotool scrot x11-utils".into(),
            }),
        });

        (StatusCode::SERVICE_UNAVAILABLE, axum::Json(error))
    }

    Router::default()
        .route("/{*path}", axum::routing::any(disabled))
        .route("/", axum::routing::any(disabled))
}
