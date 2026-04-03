// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("forbidden: {0}")]
    Forbidden(String),

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("request timeout: {0}")]
    Timeout(String),

    #[error("too many requests: {0}")]
    TooManyRequests(String),

    #[error("internal error: {0}")]
    Internal(String),

    #[error("executor unreachable: {0}")]
    ExecutorUnreachable(String),

    #[error("executor bad response: {0}")]
    ExecutorBadResponse(String),

    #[cfg(feature = "sqlx")]
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),

    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),

    #[cfg(feature = "validator")]
    #[error(transparent)]
    Validation(#[from] validator::ValidationErrors),
}

impl AppError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }

    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(msg.into())
    }

    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::Forbidden(msg.into())
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(msg.into())
    }

    pub fn service_unavailable(msg: impl Into<String>) -> Self {
        Self::ServiceUnavailable(msg.into())
    }

    pub fn timeout(msg: impl Into<String>) -> Self {
        Self::Timeout(msg.into())
    }

    pub fn too_many_requests(msg: impl Into<String>) -> Self {
        Self::TooManyRequests(msg.into())
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    pub fn entity_not_found(entity: &str, id: impl std::fmt::Display) -> Self {
        Self::NotFound(format!("{entity} {id} not found"))
    }

    pub fn from_executor_error(status: Option<u16>, err: anyhow::Error) -> Self {
        let msg = err.to_string();

        if let Some(code) = status {
            return match code {
                400 => Self::BadRequest(msg),
                401 => Self::Unauthorized(msg),
                403 => Self::Forbidden(msg),
                404 => Self::NotFound(msg),
                408 => Self::Timeout(msg),
                409 => Self::Conflict(msg),
                429 => Self::TooManyRequests(msg),
                502 | 503 => Self::ServiceUnavailable(msg),
                504 => Self::Timeout(msg),
                _ if code >= 500 => Self::ExecutorBadResponse(msg),
                _ => Self::ExecutorBadResponse(msg),
            };
        }

        if msg.contains("ECONNRESET")
            || msg.contains("connection reset")
            || msg.contains("broken pipe")
            || msg.contains("Connection refused")
            || msg.contains("timed out")
        {
            Self::ExecutorUnreachable(msg)
        } else {
            Self::ExecutorBadResponse(msg)
        }
    }
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub status_code: u16,
    pub error: String,
    pub message: String,
    pub code: String,
    pub path: String,
    pub method: String,
    pub timestamp: String,
}

impl AppError {
    fn status_and_message(self) -> (StatusCode, String) {
        match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg),
            AppError::ServiceUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, msg),
            AppError::Timeout(msg) => (StatusCode::REQUEST_TIMEOUT, msg),
            AppError::TooManyRequests(msg) => (StatusCode::TOO_MANY_REQUESTS, msg),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            AppError::ExecutorUnreachable(msg) => {
                tracing::error!(%msg, "executor unreachable");
                (StatusCode::SERVICE_UNAVAILABLE, msg)
            }
            AppError::ExecutorBadResponse(msg) => {
                tracing::error!(%msg, "executor bad response");
                (StatusCode::BAD_GATEWAY, msg)
            }
            #[cfg(feature = "validator")]
            AppError::Validation(err) => (StatusCode::BAD_REQUEST, err.to_string()),
            #[cfg(feature = "sqlx")]
            AppError::Sqlx(err) => {
                if let sqlx::Error::RowNotFound = err {
                    (StatusCode::NOT_FOUND, "resource not found".into())
                } else {
                    tracing::error!(%err, "database error");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "internal server error".into(),
                    )
                }
            }
            AppError::Anyhow(err) => {
                tracing::error!(%err, "internal error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal server error".into(),
                )
            }
        }
    }

    pub fn into_error_response(self, path: &str, method: &str) -> ErrorResponse {
        let (status, message) = self.status_and_message();
        let reason = status.canonical_reason().unwrap_or("Unknown");
        ErrorResponse {
            status_code: status.as_u16(),
            error: reason.to_string(),
            message,
            code: reason.to_uppercase().replace(' ', "_"),
            path: path.to_owned(),
            method: method.to_owned(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = self.status_and_message();
        let reason = status.canonical_reason().unwrap_or("Unknown");

        let body = ErrorResponse {
            status_code: status.as_u16(),
            error: reason.to_string(),
            message,
            code: reason.to_uppercase().replace(' ', "_"),
            path: String::default(),
            method: String::default(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        (status, Json(body)).into_response()
    }
}

pub async fn enrich_error_response(request: Request, next: Next) -> Response {
    let method = request.method().to_string();
    let path = request.uri().path().to_string();

    let response = next.run(request).await;

    if !response.status().is_client_error() && !response.status().is_server_error() {
        return response;
    }

    let (parts, body) = response.into_parts();
    let bytes = match axum::body::to_bytes(body, 64 * 1024).await {
        Ok(b) => b,
        Err(_) => return Response::from_parts(parts, axum::body::Body::empty()),
    };

    if let Ok(mut err_body) = serde_json::from_slice::<ErrorResponse>(&bytes) {
        if err_body.path.is_empty() {
            err_body.path = path;
        }
        if err_body.method.is_empty() {
            err_body.method = method;
        }
        if let Ok(enriched) = serde_json::to_vec(&err_body) {
            let mut response = Response::from_parts(parts, axum::body::Body::from(enriched));
            response.headers_mut().insert(
                axum::http::header::CONTENT_TYPE,
                axum::http::header::HeaderValue::from_static("application/json"),
            );
            return response;
        }
    }

    Response::from_parts(parts, axum::body::Body::from(bytes))
}

#[cfg(feature = "reqwest")]
impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound(err.to_string()),
            std::io::ErrorKind::PermissionDenied => AppError::Forbidden(err.to_string()),
            _ => AppError::Internal(err.to_string()),
        }
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
