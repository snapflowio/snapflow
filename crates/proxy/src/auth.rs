// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::time::Duration;

use axum::http::{HeaderMap, Uri};
use base64::Engine;
use cookie::Cookie;
use rand::Rng;
use sha2::{Digest, Sha256};
use tracing::debug;

use crate::state::AppState;

// Prefix for our "authenticated" cookie
const AUTH_COOKIE_PREFIX: &str = "snapflow-sandbox-auth-";

// Header that controls whether the warning preview is shown
const AUTH_KEY_HEADER: &str = "X-Snapflow-Preview-Token";

// URL query parameter where the auth key is kept
const AUTH_KEY_QUERY_PARAM: &str = "SNAPFLOW_SANDBOX_AUTH_KEY";

pub enum AuthResult {
    Authenticated,
    AuthenticatedStripQueryParam(&'static str),
    OAuthRedirect(String),
    Unauthorized(String),
}

pub async fn authenticate(
    state: &AppState,
    headers: &HeaderMap,
    uri: &Uri,
    sandbox_id: &str,
    request_host: &str,
) -> AuthResult {
    // Attempt bearer auth first (HTTP requests)
    if let Some(result) = try_bearer_auth(state, headers, sandbox_id).await {
        return result;
    }

    // Check for auth key (query param)
    if let Some(result) = try_auth_key(state, headers, uri, sandbox_id).await {
        return result;
    }

    // Check for existing session (cookies)
    if let Some(result) = try_cookie_auth(state, headers, sandbox_id) {
        return result;
    }

    // Setup Oauth flow for authentication, redirect back to site
    if let Some(authorize_url) = state.config.oauth_authorize_url() {
        let return_to = format!("{}://{}{}", state.config.proxy_protocol, request_host, uri);
        let nonce = generate_nonce();

        // Store nonce for CSRF verification on callback (5 minute TTL)
        if let Err(e) = state
            .nonce_cache
            .set(&nonce, &true, std::time::Duration::from_secs(300))
            .await
        {
            debug!(error = %e, "failed to store OAuth nonce");
        }

        let state_data = serde_json::json!({
            "nonce": nonce,
            "sandboxId": sandbox_id,
            "returnTo": return_to,
        });

        let encoded_state =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(state_data.to_string());

        // Generate the callback URL
        let callback_url = format!(
            "{}://{}/callback",
            state.config.proxy_protocol, request_host,
        );

        // Generate the URL to redirect back to
        let redirect_url = format!(
            "{}?sandbox_id={}&callback_url={}&state={}",
            authorize_url,
            sandbox_id,
            url::form_urlencoded::byte_serialize(callback_url.as_bytes()).collect::<String>(),
            encoded_state,
        );

        debug!(sandbox_id, "redirecting to OAuth authorize");
        return AuthResult::OAuthRedirect(redirect_url);
    }

    debug!(sandbox_id, "no authentication found");
    AuthResult::Unauthorized("authentication required".into())
}

async fn try_bearer_auth(
    state: &AppState,
    headers: &HeaderMap,
    sandbox_id: &str,
) -> Option<AuthResult> {
    // Extract the token from the `Authorization header`
    let auth_header = headers.get(http::header::AUTHORIZATION)?;
    let val = auth_header.to_str().ok()?;
    let token = val.strip_prefix("Bearer ")?.trim();

    // If token is empty
    if token.is_empty() {
        return None;
    }

    // Check if user can actually access this sandbox
    Some(match check_access_via_api(state, sandbox_id, token).await {
        Ok(true) => {
            debug!(sandbox_id, "bearer token validated via API");
            AuthResult::Authenticated
        }
        Ok(false) => AuthResult::Unauthorized("no access to this sandbox".into()),
        Err(e) => AuthResult::Unauthorized(format!("failed to validate bearer: {e}")),
    })
}

async fn try_auth_key(
    state: &AppState,
    headers: &HeaderMap,
    uri: &Uri,
    sandbox_id: &str,
) -> Option<AuthResult> {
    // Try to get auth key from headers first
    let from_header = headers
        .get(AUTH_KEY_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_owned());

    // Try to get it from query parameters as well
    let from_query = extract_query_param(uri, AUTH_KEY_QUERY_PARAM);
    let is_from_query = from_header.is_none() && from_query.is_some();
    let auth_key = from_header.or(from_query)?;

    // Check if the user has access to the sandbox
    Some(
        match validate_auth_key(state, sandbox_id, &auth_key).await {
            Ok(true) => {
                debug!(sandbox_id, "auth key validated");
                if is_from_query {
                    AuthResult::AuthenticatedStripQueryParam(AUTH_KEY_QUERY_PARAM)
                } else {
                    AuthResult::Authenticated
                }
            }
            Ok(false) => AuthResult::Unauthorized("invalid auth key".into()),
            Err(e) => AuthResult::Unauthorized(format!("failed to validate auth key: {e}")),
        },
    )
}

fn try_cookie_auth(state: &AppState, headers: &HeaderMap, sandbox_id: &str) -> Option<AuthResult> {
    let cookie_str = headers.get(http::header::COOKIE)?.to_str().ok()?;
    let cookie_name = format!("{AUTH_COOKIE_PREFIX}{sandbox_id}");

    let value = Cookie::split_parse_encoded(cookie_str)
        .filter_map(|c| c.ok())
        .find(|c| c.name() == cookie_name)?
        .value()
        .to_owned();

    if let Some(verified_id) =
        snapflow_auth::hmac_cookie::verify(&value, state.config.proxy_api_key.as_bytes())
        && verified_id == sandbox_id
    {
        debug!(sandbox_id, "cookie auth verified");
        return Some(AuthResult::Authenticated);
    }

    None
}

async fn check_access_via_api(
    state: &AppState,
    sandbox_id: &str,
    token: &str,
) -> anyhow::Result<bool> {
    // Check if access is cached in redis
    let cache_key = format!("access:{sandbox_id}:{}", hash_token(token));
    if let Some(cached) = state.auth_key_cache.get(&cache_key).await? {
        return Ok(cached);
    }

    let mut user_config = state.api_config.clone();
    user_config.bearer_access_token = Some(token.to_owned());

    // Contact API to make sure user actually has access to sandbox
    match snapflow_api_client::apis::preview_api::has_sandbox_access(&user_config, sandbox_id).await
    {
        Ok(()) => {
            let _ = state
                .auth_key_cache
                .set(&cache_key, &true, Duration::from_secs(120))
                .await;
            Ok(true)
        }
        Err(snapflow_api_client::apis::Error::ResponseError(resp)) => {
            let _ = state
                .auth_key_cache
                .set(&cache_key, &false, Duration::from_secs(120))
                .await;
            debug!(sandbox_id, status = %resp.status, "access denied by API");
            Ok(false)
        }
        Err(e) => Err(anyhow::anyhow!("API request failed: {e}")),
    }
}

async fn validate_auth_key(
    state: &AppState,
    sandbox_id: &str,
    auth_key: &str,
) -> anyhow::Result<bool> {
    // Extract auth token from Redis cache
    let cache_key = format!("authkey:{sandbox_id}:{}", hash_token(auth_key));
    if let Some(cached) = state.auth_key_cache.get(&cache_key).await? {
        return Ok(cached);
    }

    // Check if the actual auth token is valid
    match snapflow_api_client::apis::preview_api::is_valid_auth_token(
        &state.api_config,
        sandbox_id,
        auth_key,
    )
    .await
    {
        Ok(is_valid) => {
            let _ = state
                .auth_key_cache
                .set(&cache_key, &is_valid, Duration::from_secs(120))
                .await;
            Ok(is_valid)
        }
        Err(snapflow_api_client::apis::Error::ResponseError(resp)) => {
            let _ = state
                .auth_key_cache
                .set(&cache_key, &false, Duration::from_secs(120))
                .await;
            debug!(sandbox_id, status = %resp.status, "auth key denied by API");
            Ok(false)
        }
        Err(e) => Err(anyhow::anyhow!("API request failed: {e}")),
    }
}

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::default();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

fn extract_query_param(uri: &Uri, param: &str) -> Option<String> {
    uri.query().and_then(|q| {
        url::form_urlencoded::parse(q.as_bytes())
            .find(|(k, _)| k == param)
            .map(|(_, v)| v.into_owned())
    })
}

pub fn strip_query_param(uri: &Uri, param: &str) -> http::Uri {
    let path = uri.path();
    let new_path_and_query = match uri.query() {
        None => path.to_owned(),
        Some(q) => {
            let filtered: String = url::form_urlencoded::parse(q.as_bytes())
                .filter(|(k, _)| k != param)
                .map(|(k, v)| format!("{k}={v}"))
                .collect::<Vec<_>>()
                .join("&");
            if filtered.is_empty() {
                path.to_owned()
            } else {
                format!("{path}?{filtered}")
            }
        }
    };

    new_path_and_query.parse().unwrap_or_else(|_| uri.clone())
}

fn generate_nonce() -> String {
    let mut buf = [0u8; 32];
    rand::rng().fill(&mut buf);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf)
}

pub fn build_sandbox_cookie(state: &AppState, sandbox_id: &str) -> String {
    let cookie_name = format!("{AUTH_COOKIE_PREFIX}{sandbox_id}");
    let signed =
        snapflow_auth::hmac_cookie::sign(sandbox_id, state.config.proxy_api_key.as_bytes());
    let secure = state.config.enable_tls;
    let domain_part = state
        .config
        .cookie_domain()
        .map(|d| format!("; Domain={d}"))
        .unwrap_or_default();
    format!(
        "{cookie_name}={signed}; Max-Age=3600; Path=/{domain_part}; HttpOnly; SameSite=Lax{}",
        if secure { "; Secure" } else { "" }
    )
}
