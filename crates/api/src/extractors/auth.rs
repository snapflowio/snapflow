// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use uuid::Uuid;

use crate::models::ApiKey;
use crate::state::AppState;
use snapflow_errors::AppError;
use snapflow_models::SystemRole;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthMethod {
    Session,
    ApiKey,
    Proxy,
}

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: Uuid,
    pub email: String,
    pub role: SystemRole,
    pub organization_id: Option<Uuid>,
    pub api_key: Option<ApiKey>,
    pub method: AuthMethod,
}

impl FromRequestParts<AppState> for AuthContext {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthContext>()
            .cloned()
            .ok_or(AppError::Unauthorized("authentication required".into()))
    }
}

pub struct SessionAuth {
    pub auth: AuthContext,
}

impl FromRequestParts<AppState> for SessionAuth {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth = parts
            .extensions
            .get::<AuthContext>()
            .cloned()
            .ok_or(AppError::Unauthorized("authentication required".into()))?;

        if auth.method != AuthMethod::Session {
            return Err(AppError::Unauthorized(
                "session authentication required".into(),
            ));
        }

        Ok(SessionAuth { auth })
    }
}

pub struct SessionOrApiKeyAuth {
    pub auth: AuthContext,
}

impl FromRequestParts<AppState> for SessionOrApiKeyAuth {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth = parts
            .extensions
            .get::<AuthContext>()
            .cloned()
            .ok_or(AppError::Unauthorized("authentication required".into()))?;

        if !matches!(auth.method, AuthMethod::Session | AuthMethod::ApiKey) {
            return Err(AppError::Unauthorized("session or API key required".into()));
        }

        Ok(SessionOrApiKeyAuth { auth })
    }
}

pub struct AdminOrProxyAuth {
    pub auth: AuthContext,
}

impl FromRequestParts<AppState> for AdminOrProxyAuth {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth = parts
            .extensions
            .get::<AuthContext>()
            .cloned()
            .ok_or(AppError::Unauthorized("authentication required".into()))?;

        if !matches!(auth.role, SystemRole::Admin | SystemRole::Proxy) {
            return Err(AppError::Forbidden("admin or proxy access required".into()));
        }

        Ok(AdminOrProxyAuth { auth })
    }
}
