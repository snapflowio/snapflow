// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::State;
use axum::http::Request;
use axum::http::header::HeaderMap;
use axum::middleware::Next;
use axum::response::Response;
use redis::AsyncCommands;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use uuid::Uuid;

use crate::constants::auth as auth_constants;
use crate::extractors::auth::{AuthContext, AuthMethod};
use crate::repositories;
use crate::state::AppState;
use crate::utils::cookies;
use common_rs::constants::headers;
use snapflow_errors::AppError;
use snapflow_models::SystemRole;

pub async fn require_auth(
    State(state): State<AppState>,
    request_headers: HeaderMap,
    mut request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, AppError> {
    let ctx = if let Some(ctx) = try_jwt_auth(&state, &request_headers).await {
        ctx
    } else if let Some(ctx) = try_proxy_auth(&state, &request_headers) {
        ctx
    } else if let Some(ctx) = try_api_key_auth(&state, &request_headers).await {
        ctx
    } else {
        return Err(AppError::Unauthorized("authentication required".into()));
    };

    request.extensions_mut().insert(ctx);
    Ok(next.run(request).await)
}

async fn try_jwt_auth(state: &AppState, headers: &HeaderMap) -> Option<AuthContext> {
    let cookie_token = cookies::get_access_token(headers);

    let token = if let Some(auth_header) = headers.get("authorization") {
        let auth_str = auth_header.to_str().ok()?;
        auth_str.strip_prefix("Bearer ")?
    } else {
        cookie_token.as_deref()?
    };

    let claims = state.infra.jwt.verify(token).ok()?;

    // Check if token is blacklisted
    let blacklist_key = format!("jwt:blacklist:{}", claims.jti);
    let is_blacklisted: bool = state
        .infra
        .redis
        .clone()
        .exists(&blacklist_key)
        .await
        .unwrap_or(false);

    if is_blacklisted {
        return None;
    }

    let org_id = headers
        .get(headers::ORGANIZATION_ID)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| Uuid::parse_str(v).ok());

    Some(AuthContext {
        user_id: claims.sub,
        email: claims.email,
        role: claims.role,
        organization_id: org_id,
        api_key: None,
        method: AuthMethod::Session,
    })
}

fn try_proxy_auth(state: &AppState, headers: &HeaderMap) -> Option<AuthContext> {
    let auth_header = headers.get("authorization")?.to_str().ok()?;
    let token = auth_header.strip_prefix("Bearer ")?;

    let expected = &state.infra.config.proxy.api_key;
    if expected.is_empty() || !constant_time_eq(token.as_bytes(), expected.as_bytes()) {
        return None;
    }

    Some(AuthContext {
        user_id: Uuid::nil(),
        email: String::default(),
        role: SystemRole::Proxy,
        organization_id: None,
        api_key: None,
        method: AuthMethod::Proxy,
    })
}

async fn try_api_key_auth(state: &AppState, headers: &HeaderMap) -> Option<AuthContext> {
    let key_value = headers.get("authorization").and_then(|v| v.to_str().ok())?;

    let key_value = key_value.strip_prefix("Bearer ").unwrap_or(key_value);

    let key_hash = hex::encode(Sha256::digest(key_value.as_bytes()));

    let cache_key = format!("api-key:validation:{key_hash}");
    let api_key = match get_cached_api_key(state, &cache_key).await {
        Some(ak) => ak,
        None => {
            let ak = repositories::api_key::find_by_key_hash(&state.infra.pool, &key_hash)
                .await
                .ok()??;

            if ak.expires_at.is_some_and(|exp| exp < chrono::Utc::now()) {
                return None;
            }

            cache_api_key(state, &cache_key, &ak).await;
            ak
        }
    };

    if api_key
        .expires_at
        .is_some_and(|exp| exp < chrono::Utc::now())
    {
        return None;
    }

    update_last_used_with_cooldown(state, &api_key).await;

    let user_cache_key = format!("api-key:user:{}", api_key.user_id);
    let user = match get_cached_user(state, &user_cache_key).await {
        Some(u) => u,
        None => {
            let u = repositories::user::find_by_id(&state.infra.pool, api_key.user_id)
                .await
                .ok()??;

            cache_user(state, &user_cache_key, &u).await;
            u
        }
    };

    if user.banned {
        return None;
    }

    Some(AuthContext {
        user_id: user.id,
        email: user.email,
        role: user.role,
        organization_id: Some(api_key.organization_id),
        api_key: Some(api_key),
        method: AuthMethod::ApiKey,
    })
}

async fn get_cached_api_key(state: &AppState, cache_key: &str) -> Option<crate::models::ApiKey> {
    let data: Option<String> = state.infra.redis.clone().get(cache_key).await.ok()?;
    data.and_then(|json| serde_json::from_str(&json).ok())
}

async fn cache_api_key(state: &AppState, cache_key: &str, api_key: &crate::models::ApiKey) {
    if let Ok(json) = serde_json::to_string(api_key) {
        let _: Result<(), _> = state
            .infra
            .redis
            .clone()
            .set_ex(
                cache_key,
                json,
                auth_constants::API_KEY_VALIDATION_CACHE_TTL_SECS,
            )
            .await;
    }
}

async fn get_cached_user(state: &AppState, cache_key: &str) -> Option<crate::models::User> {
    let data: Option<String> = state.infra.redis.clone().get(cache_key).await.ok()?;
    data.and_then(|json| serde_json::from_str(&json).ok())
}

async fn cache_user(state: &AppState, cache_key: &str, user: &crate::models::User) {
    if let Ok(json) = serde_json::to_string(user) {
        let _: Result<(), _> = state
            .infra
            .redis
            .clone()
            .set_ex(cache_key, json, auth_constants::API_KEY_USER_CACHE_TTL_SECS)
            .await;
    }
}

async fn update_last_used_with_cooldown(state: &AppState, api_key: &crate::models::ApiKey) {
    let cooldown_key = format!(
        "api-key:last-used:{}:{}:{}",
        api_key.organization_id, api_key.user_id, api_key.name
    );

    let locked = state
        .infra
        .lock
        .lock_with_code(
            &cooldown_key,
            auth_constants::API_KEY_LAST_USED_COOLDOWN_SECS,
            "1",
        )
        .await
        .unwrap_or(false);

    if !locked {
        return;
    }

    let pool = state.infra.pool.clone();
    let org_id = api_key.organization_id;
    let uid = api_key.user_id;
    let name = api_key.name.clone();
    tokio::spawn(async move {
        if let Err(e) = repositories::api_key::update_last_used(&pool, org_id, uid, &name).await {
            tracing::warn!(error = %e, "failed to update api key last_used_at");
        }
    });
}

/// Constant-time byte comparison to prevent timing side-channel attacks on secrets.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.ct_eq(b).into()
}
