// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use rand::Rng;
use uuid::Uuid;

use crate::constants::auth::{ALLOWED_CLIENT_ID, AUTH_CODE_LENGTH};
use crate::infra::Infra;
use crate::repositories;
use snapflow_errors::{AppError, Result};

#[derive(serde::Serialize, serde::Deserialize)]
pub struct StoredAuthCode {
    pub user_id: Uuid,
    pub sandbox_id: Uuid,
    pub redirect_uri: String,
    pub client_id: String,
}

pub struct AuthorizeParams {
    pub user_id: Uuid,
    pub sandbox_id: Uuid,
    pub redirect_uri: String,
    pub client_id: String,
    pub api_key_org_id: Option<Uuid>,
}

pub struct ExchangeParams {
    pub grant_type: String,
    pub code: String,
    pub redirect_uri: String,
    pub client_id: String,
}

pub struct ExchangeResult {
    pub access_token: String,
    pub sandbox_id: Uuid,
}

pub async fn authorize(infra: &Infra, params: &AuthorizeParams) -> Result<String> {
    validate_client_id(&params.client_id)?;
    validate_redirect_uri(&params.redirect_uri)?;

    let has_access = crate::services::preview::has_sandbox_access(
        &infra.pool,
        params.sandbox_id,
        params.user_id,
        params.api_key_org_id,
    )
    .await?;

    if !has_access {
        return Err(AppError::Forbidden("no access to this sandbox".into()));
    }

    let code = generate_auth_code();

    let stored = StoredAuthCode {
        user_id: params.user_id,
        sandbox_id: params.sandbox_id,
        redirect_uri: params.redirect_uri.clone(),
        client_id: params.client_id.clone(),
    };

    let serialized = serde_json::to_string(&stored)
        .map_err(|_| AppError::Internal("failed to serialize authorization code".into()))?;

    let mut conn = infra.redis.clone();
    repositories::oauth_code::store(&mut conn, &code, &serialized).await?;

    Ok(code)
}

pub async fn exchange_code(infra: &Infra, params: &ExchangeParams) -> Result<ExchangeResult> {
    if params.grant_type != "authorization_code" {
        return Err(AppError::BadRequest("unsupported grant_type".into()));
    }

    validate_client_id(&params.client_id)?;

    let mut conn = infra.redis.clone();
    let stored_json = repositories::oauth_code::consume(&mut conn, &params.code)
        .await?
        .ok_or_else(|| AppError::BadRequest("invalid or expired authorization code".into()))?;

    let stored: StoredAuthCode = serde_json::from_str(&stored_json)
        .map_err(|_| AppError::Internal("failed to parse stored authorization code".into()))?;

    if stored.redirect_uri != params.redirect_uri {
        return Err(AppError::BadRequest("redirect_uri mismatch".into()));
    }

    if stored.client_id != params.client_id {
        return Err(AppError::BadRequest("client_id mismatch".into()));
    }

    let user = repositories::user::find_by_id(&infra.pool, stored.user_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("user not found".into()))?;

    let access_token = infra
        .jwt
        .sign(user.id, &user.email, user.role)
        .map_err(|_| AppError::Internal("failed to sign access token".into()))?;

    Ok(ExchangeResult {
        access_token,
        sandbox_id: stored.sandbox_id,
    })
}

fn validate_client_id(client_id: &str) -> Result<()> {
    if client_id != ALLOWED_CLIENT_ID {
        return Err(AppError::BadRequest("unknown client_id".into()));
    }
    Ok(())
}

fn validate_redirect_uri(redirect_uri: &str) -> Result<()> {
    let parsed = url::Url::parse(redirect_uri)
        .map_err(|_| AppError::BadRequest("invalid redirect_uri".into()))?;

    let host = parsed.host_str().unwrap_or("");
    if !host.ends_with(".localhost") && host != "localhost" {
        let scheme = parsed.scheme();
        if scheme != "https" {
            return Err(AppError::BadRequest(
                "redirect_uri must use HTTPS for non-localhost domains".into(),
            ));
        }
    }

    let path = parsed.path();
    if path != "/callback" {
        return Err(AppError::BadRequest(
            "redirect_uri path must be /callback".into(),
        ));
    }

    Ok(())
}

fn generate_auth_code() -> String {
    const ALPHABET: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut rng = rand::rng();
    (0..AUTH_CODE_LENGTH)
        .map(|_| ALPHABET[rng.random_range(0..ALPHABET.len())] as char)
        .collect()
}
