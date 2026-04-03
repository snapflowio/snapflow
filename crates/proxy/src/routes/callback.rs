// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::{
    body::Body,
    extract::{Request, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};

use base64::Engine;
use serde::{Deserialize, Serialize};
use tracing::{debug, error};

use crate::auth;
use crate::state::SharedState;

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: String,
    pub state: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CallbackState {
    nonce: String,
    sandbox_id: String,
    return_to: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TokenExchangeRequest {
    grant_type: &'static str,
    code: String,
    redirect_uri: String,
    client_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TokenExchangeResponse {
    sandbox_id: String,
}

pub async fn handle_callback_from_request(
    State(state): State<SharedState>,
    req: Request<Body>,
) -> Response {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or(&state.config.proxy_domain)
        .to_string();

    let uri = req.uri().clone();
    let query_string = uri.query().unwrap_or("");
    let query: CallbackQuery = match serde_urlencoded::from_str(query_string) {
        Ok(q) => q,
        Err(e) => {
            error!(error = %e, "missing or invalid callback query parameters");
            return (StatusCode::BAD_REQUEST, "missing code or state").into_response();
        }
    };

    handle_callback_inner(&state, &host, query).await
}

async fn handle_callback_inner(
    state: &SharedState,
    request_host: &str,
    query: CallbackQuery,
) -> Response {
    let decoded_bytes = match base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(&query.state)
    {
        Ok(b) => b,
        Err(e) => {
            error!(error = %e, "failed to decode callback state");
            return (StatusCode::BAD_REQUEST, "invalid state").into_response();
        }
    };

    let decoded_str = match String::from_utf8(decoded_bytes) {
        Ok(s) => s,
        Err(e) => {
            error!(error = %e, "callback state is not valid UTF-8");
            return (StatusCode::BAD_REQUEST, "invalid state").into_response();
        }
    };

    let callback_state: CallbackState = match serde_json::from_str(&decoded_str) {
        Ok(d) => d,
        Err(e) => {
            error!(error = %e, "failed to parse callback state");
            return (StatusCode::BAD_REQUEST, "invalid state").into_response();
        }
    };

    // Verify and consume the nonce to prevent CSRF and replay attacks
    if let Ok(Some(true)) = state.nonce_cache.get(&callback_state.nonce).await {
        // Consume: delete nonce so it can't be reused
        let _ = state.nonce_cache.delete(&callback_state.nonce).await;
    } else {
        error!("invalid or expired OAuth nonce");
        return (StatusCode::BAD_REQUEST, "invalid or expired state").into_response();
    }

    let Some(token_url) = state.config.oauth_token_url() else {
        return (StatusCode::INTERNAL_SERVER_ERROR, "OAuth not configured").into_response();
    };

    let callback_url = format!(
        "{}://{}/callback",
        state.config.proxy_protocol, request_host,
    );

    let exchange_body = TokenExchangeRequest {
        grant_type: "authorization_code",
        code: query.code,
        redirect_uri: callback_url,
        client_id: state.config.oauth_client_id.clone(),
    };

    let resp = match state
        .http_client
        .post(token_url)
        .json(&exchange_body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "failed to exchange authorization code");
            return (StatusCode::BAD_GATEWAY, "token exchange failed").into_response();
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        error!(status = %status, body, "token exchange rejected");
        return (StatusCode::UNAUTHORIZED, "authorization code rejected").into_response();
    }

    let token_resp: TokenExchangeResponse = match resp.json().await {
        Ok(t) => t,
        Err(e) => {
            error!(error = %e, "failed to parse token response");
            return (StatusCode::BAD_GATEWAY, "invalid token response").into_response();
        }
    };

    if token_resp.sandbox_id != callback_state.sandbox_id {
        error!(
            expected = callback_state.sandbox_id,
            got = token_resp.sandbox_id,
            "sandbox_id mismatch between state and token response"
        );
        return (StatusCode::BAD_REQUEST, "sandbox_id mismatch").into_response();
    }

    let cookie = auth::build_sandbox_cookie(state, &callback_state.sandbox_id);

    debug!(
        sandbox_id = callback_state.sandbox_id,
        "OAuth callback successful, setting cookie"
    );

    let return_to = validate_return_to(&callback_state.return_to, &state.config.proxy_domain);

    Response::builder()
        .status(StatusCode::FOUND)
        .header(header::LOCATION, &return_to)
        .header(header::SET_COOKIE, cookie)
        .body(Body::empty())
        .unwrap_or_else(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to build redirect",
            )
                .into_response()
        })
}

fn validate_return_to(return_to: &str, proxy_domain: &str) -> String {
    let Ok(parsed) = url::Url::parse(return_to) else {
        return "/".to_string();
    };

    let host = parsed.host_str().unwrap_or("");
    let proxy_host = proxy_domain.split(':').next().unwrap_or(proxy_domain);

    if host == proxy_host || host.ends_with(&format!(".{proxy_host}")) {
        return_to.to_string()
    } else {
        "/".to_string()
    }
}
