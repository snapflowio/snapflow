// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::extractors::auth::AuthContext;
use crate::services;
use crate::state::AppState;
use snapflow_errors::Result;

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeRequest {
    pub sandbox_id: Uuid,
    pub redirect_uri: String,
    pub state: String,
    pub client_id: String,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeResponse {
    pub code: String,
    pub redirect_uri: String,
    pub state: String,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TokenRequest {
    pub grant_type: String,
    pub code: String,
    pub redirect_uri: String,
    pub client_id: String,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub sandbox_id: String,
}

#[utoipa::path(
    post,
    path = "/oauth/authorize",
    tag = "oauth",
    operation_id = "oauthAuthorize",
    request_body = AuthorizeRequest,
    responses(
        (status = 200, body = AuthorizeResponse),
        (status = 403, description = "No access to sandbox"),
    ),
    security(("bearer" = []))
)]
pub async fn authorize(
    auth: AuthContext,
    State(state): State<AppState>,
    Json(body): Json<AuthorizeRequest>,
) -> Result<Json<AuthorizeResponse>> {
    let code = services::oauth::authorize(
        &state.infra,
        &services::oauth::AuthorizeParams {
            user_id: auth.user_id,
            sandbox_id: body.sandbox_id,
            redirect_uri: body.redirect_uri.clone(),
            client_id: body.client_id,
            api_key_org_id: auth.api_key.as_ref().map(|k| k.organization_id),
        },
    )
    .await?;

    Ok(Json(AuthorizeResponse {
        code,
        redirect_uri: body.redirect_uri,
        state: body.state,
    }))
}

#[utoipa::path(
    post,
    path = "/oauth/token",
    tag = "oauth",
    operation_id = "oauthExchangeToken",
    request_body = TokenRequest,
    responses(
        (status = 200, body = TokenResponse),
        (status = 400, description = "Invalid code or grant type"),
    )
)]
pub async fn exchange_token(
    State(state): State<AppState>,
    Json(body): Json<TokenRequest>,
) -> Result<(StatusCode, Json<TokenResponse>)> {
    let result = services::oauth::exchange_code(
        &state.infra,
        &services::oauth::ExchangeParams {
            grant_type: body.grant_type,
            code: body.code,
            redirect_uri: body.redirect_uri,
            client_id: body.client_id,
        },
    )
    .await?;

    Ok((
        StatusCode::OK,
        Json(TokenResponse {
            access_token: result.access_token,
            token_type: "Bearer".into(),
            expires_in: 3600,
            sandbox_id: result.sandbox_id.to_string(),
        }),
    ))
}
