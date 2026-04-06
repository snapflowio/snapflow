// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;
use std::time::Duration;

use axum::{
    body::Body,
    extract::{Request, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use tracing::{debug, error};

use super::warning;
use crate::{
    auth::{self, AuthResult},
    state::SharedState,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutorInfo {
    #[serde(rename = "apiUrl")]
    pub api_url: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
}

// Ports for built-in services
const TERMINAL_PORT: &str = "22222";
const TOOLBOX_PORT: &str = "2280";
const VNC_PORT: &str = "6080";

fn parse_host(host: &str) -> Option<(String, String)> {
    let subdomain = host.split('.').next()?;
    let (port, sandbox_id) = subdomain.split_once('-')?;
    if port.is_empty() || sandbox_id.is_empty() {
        return None;
    }

    Some((port.to_string(), sandbox_id.to_string()))
}

fn parse_toolbox_subpath(path: &str) -> Option<(String, String)> {
    let rest = path.strip_prefix("/toolbox/")?;
    let (sandbox_id, target_path) = rest.split_once('/')?;
    if sandbox_id.is_empty() {
        return None;
    }

    Some((sandbox_id.to_string(), format!("/{target_path}")))
}

fn requires_auth(is_public: bool, target_port: &str) -> bool {
    !is_public
        || target_port == TERMINAL_PORT
        || target_port == TOOLBOX_PORT
        || target_port == VNC_PORT
}

fn oauth_redirect(url: &str) -> Response {
    Response::builder()
        .status(StatusCode::TEMPORARY_REDIRECT)
        .header(header::LOCATION, url)
        .body(Body::empty())
        .unwrap_or_else(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to build redirect",
            )
                .into_response()
        })
}

pub async fn proxy_handler(State(state): State<SharedState>, req: Request<Body>) -> Response {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let method = req.method().clone();
    let path = req.uri().path().to_string();

    if method == http::Method::POST && path == "/accept-snapflow-preview-warning" {
        return warning::handle_accept_warning(req).await;
    }

    if method == http::Method::GET && path == "/callback" {
        return super::callback::handle_callback_from_request(State(state), req).await;
    }

    if let Some((target_port, sandbox_id)) = parse_host(&host) {
        if state.config.restricted_mode && target_port != TOOLBOX_PORT {
            return (StatusCode::NOT_FOUND, "not found").into_response();
        }

        return handle_subdomain_proxy(state, req, &host, &target_port, &sandbox_id).await;
    }

    if method == http::Method::GET {
        if path.as_str() == "/health" {
            return axum::Json(serde_json::json!({
                "status": "ok",
                "version": super::health::VERSION
            }))
            .into_response();
        }
    }

    if path.starts_with("/toolbox/")
        && let Some((sandbox_id, target_path)) = parse_toolbox_subpath(&path)
    {
        return handle_toolbox_proxy(state, req, &sandbox_id, &target_path).await;
    }

    (StatusCode::NOT_FOUND, "not found").into_response()
}

async fn handle_subdomain_proxy(
    state: SharedState,
    mut req: Request<Body>,
    host: &str,
    target_port: &str,
    sandbox_id: &str,
) -> Response {
    let is_public = match get_sandbox_public(&state, sandbox_id).await {
        Ok(v) => v,
        Err(e) => {
            error!(error = %e, "failed to get sandbox public status");
            return (
                StatusCode::BAD_REQUEST,
                format!("failed to get sandbox public status: {e}"),
            )
                .into_response();
        }
    };

    if requires_auth(is_public, target_port) {
        match auth::authenticate(&state, req.headers(), req.uri(), sandbox_id, host).await {
            AuthResult::Authenticated => {}
            AuthResult::AuthenticatedStripQueryParam(param) => {
                *req.uri_mut() = auth::strip_query_param(req.uri(), param);
            }
            AuthResult::OAuthRedirect(url) => {
                return oauth_redirect(&url);
            }
            AuthResult::Unauthorized(msg) => {
                return (StatusCode::UNAUTHORIZED, msg).into_response();
            }
        }
    }

    let executor = match get_executor_info(&state, sandbox_id).await {
        Ok(info) => info,
        Err(e) => {
            error!(error = %e, sandbox_id, "failed to get executor info");
            return (
                StatusCode::BAD_REQUEST,
                format!("failed to get executor info: {e}"),
            )
                .into_response();
        }
    };

    send_last_activity_update(&state, sandbox_id);
    let keepalive = spawn_activity_keepalive(&state, sandbox_id);

    let path_suffix = {
        let p = req.uri().path();
        if p.is_empty() { "/" } else { p }
    };
    let query = req
        .uri()
        .query()
        .map(|q| format!("?{q}"))
        .unwrap_or_default();

    let target_url = format!(
        "{}/sandboxes/{}/toolbox/proxy/{}{path_suffix}{query}",
        executor.api_url.trim_end_matches('/'),
        sandbox_id,
        target_port,
    );

    let sandbox_id_owned = sandbox_id.to_string();
    let target_port_owned = target_port.to_string();
    let proxy_domain = state.config.proxy_domain.clone();
    let mut resp = forward_to_executor(req, &target_url, &executor).await;
    keepalive.abort();

    if resp.status().is_redirection()
        && let Some(loc) = resp.headers().get(header::LOCATION)
    {
        let loc_str = loc.to_str().unwrap_or("");
        if loc_str.starts_with('/') {
            let prefix = format!("https://{target_port_owned}-{sandbox_id_owned}.{proxy_domain}");
            if let Ok(new_loc) = format!("{prefix}{loc_str}").parse() {
                resp.headers_mut().insert(header::LOCATION, new_loc);
            }
        } else if !loc_str.contains(&format!("{target_port_owned}-{sandbox_id_owned}")) {
            let prefix = format!("https://{target_port_owned}-{sandbox_id_owned}.{proxy_domain}");
            if let Ok(new_loc) = format!("{prefix}/{loc_str}").parse() {
                resp.headers_mut().insert(header::LOCATION, new_loc);
            }
        }
    }

    resp
}

async fn handle_toolbox_proxy(
    state: SharedState,
    mut req: Request<Body>,
    sandbox_id: &str,
    target_path: &str,
) -> Response {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or(&state.config.proxy_domain);
    match auth::authenticate(&state, req.headers(), req.uri(), sandbox_id, host).await {
        AuthResult::Authenticated => {}
        AuthResult::AuthenticatedStripQueryParam(param) => {
            *req.uri_mut() = auth::strip_query_param(req.uri(), param);
        }
        AuthResult::OAuthRedirect(url) => {
            return oauth_redirect(&url);
        }
        AuthResult::Unauthorized(msg) => {
            return (StatusCode::UNAUTHORIZED, msg).into_response();
        }
    }

    let executor = match get_executor_info(&state, sandbox_id).await {
        Ok(info) => info,
        Err(e) => {
            error!(error = %e, sandbox_id, "failed to get executor info");
            return (
                StatusCode::BAD_REQUEST,
                format!("failed to get executor info: {e}"),
            )
                .into_response();
        }
    };

    send_last_activity_update(&state, sandbox_id);
    let keepalive = spawn_activity_keepalive(&state, sandbox_id);

    let query = req
        .uri()
        .query()
        .map(|q| format!("?{q}"))
        .unwrap_or_default();

    let target_url = format!(
        "{}/sandboxes/{}/toolbox{target_path}{query}",
        executor.api_url.trim_end_matches('/'),
        sandbox_id,
    );

    let sandbox_id_owned = sandbox_id.to_string();
    let mut resp = forward_to_executor(req, &target_url, &executor).await;
    keepalive.abort();

    if resp.status().is_redirection()
        && let Some(loc) = resp.headers().get(header::LOCATION)
    {
        let loc_str = loc.to_str().unwrap_or("");
        let prefix = format!("/toolbox/{sandbox_id_owned}");
        if !loc_str.starts_with(&prefix)
            && let Ok(new_loc) = format!("{prefix}{loc_str}").parse()
        {
            resp.headers_mut().insert(header::LOCATION, new_loc);
        }
    }

    resp
}

async fn forward_to_executor(
    mut req: Request<Body>,
    target_url: &str,
    executor: &ExecutorInfo,
) -> Response {
    let target_uri: http::Uri = match target_url.parse() {
        Ok(u) => u,
        Err(e) => {
            error!(error = %e, "failed to parse target URL");
            return (StatusCode::BAD_GATEWAY, "invalid target url").into_response();
        }
    };

    let authority = match target_uri.authority() {
        Some(a) => a.to_string(),
        None => return (StatusCode::BAD_GATEWAY, "no target authority").into_response(),
    };

    let path_and_query = target_uri
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    *req.uri_mut() = match path_and_query.parse() {
        Ok(u) => u,
        Err(e) => {
            error!(error = %e, "failed to parse forwarding path");
            return (StatusCode::BAD_GATEWAY, "invalid forwarding path").into_response();
        }
    };

    if let Ok(val) = format!("Bearer {}", executor.api_key).parse() {
        req.headers_mut().insert("X-Snapflow-Authorization", val);
    }
    if let Ok(val) = authority.parse() {
        req.headers_mut().insert(header::HOST, val);
    }

    let scheme = target_uri.scheme_str().unwrap_or("http");
    let use_tls = scheme == "https";

    // Ensure host:port format — default ports are implicit in authority when omitted
    let hostname = authority
        .split(':')
        .next()
        .unwrap_or(&authority)
        .to_string();
    let target_addr = if authority.contains(':') {
        authority.clone()
    } else if use_tls {
        format!("{authority}:443")
    } else {
        format!("{authority}:80")
    };

    if use_tls {
        common_rs::proxy::forward_tls(req, &target_addr, &hostname).await
    } else {
        common_rs::proxy::forward(req, &target_addr).await
    }
}

fn send_last_activity_update(state: &SharedState, sandbox_id: &str) {
    let state = Arc::clone(state);
    let sandbox_id = sandbox_id.to_string();
    tokio::spawn(async move {
        let cached = match state.last_activity_cache.get(&sandbox_id).await {
            Ok(Some(_)) => true,
            Ok(None) => false,
            Err(e) => {
                error!(error = %e, "failed to check last activity cache");
                return;
            }
        };

        if cached {
            return;
        }

        if let Err(e) = snapflow_api_client::apis::sandbox_api::update_last_activity(
            &state.api_config,
            &sandbox_id,
            None,
        )
        .await
        {
            error!(error = %e, sandbox_id, "failed to update last activity");
            return;
        }

        if let Err(e) = state
            .last_activity_cache
            .set(&sandbox_id, &true, Duration::from_secs(45))
            .await
        {
            error!(error = %e, "failed to set last activity cache");
        }
    });
}

fn spawn_activity_keepalive(state: &SharedState, sandbox_id: &str) -> tokio::task::JoinHandle<()> {
    let state = Arc::clone(state);
    let sandbox_id = sandbox_id.to_string();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(45));
        interval.tick().await;
        loop {
            interval.tick().await;
            send_last_activity_update(&state, &sandbox_id);
        }
    })
}

async fn get_executor_info(state: &SharedState, sandbox_id: &str) -> anyhow::Result<ExecutorInfo> {
    if let Some(cached) = state.executor_cache.get(sandbox_id).await? {
        return Ok(cached);
    }

    let executor = snapflow_api_client::apis::executors_api::get_executor_by_sandbox_id(
        &state.api_config,
        sandbox_id,
    )
    .await
    .map_err(|e| anyhow::anyhow!("failed to get executor info: {e}"))?;

    let info = ExecutorInfo {
        api_url: executor.api_url,
        api_key: executor.api_key,
    };

    debug!(sandbox_id, api_url = info.api_url, "fetched executor info");

    if let Err(e) = state
        .executor_cache
        .set(sandbox_id, &info, Duration::from_secs(120))
        .await
    {
        error!(error = %e, "failed to cache executor info");
    }

    Ok(info)
}

async fn get_sandbox_public(state: &SharedState, sandbox_id: &str) -> anyhow::Result<bool> {
    if let Some(cached) = state.sandbox_public_cache.get(sandbox_id).await? {
        return Ok(cached);
    }

    let is_public = match snapflow_api_client::apis::preview_api::is_sandbox_public(
        &state.api_config,
        sandbox_id,
    )
    .await
    {
        Ok(val) => val,
        Err(e) => {
            error!(error = %e, "failed to check sandbox public status");
            false
        }
    };

    if let Err(e) = state
        .sandbox_public_cache
        .set(sandbox_id, &is_public, Duration::from_secs(3600))
        .await
    {
        error!(error = %e, "failed to cache sandbox public status");
    }

    Ok(is_public)
}
