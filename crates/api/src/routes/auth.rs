// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Router;
use axum::routing::{get, post};
use utoipa::OpenApi;

use crate::handlers;
use crate::schemas;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::auth::sign_up,
        handlers::auth::sign_in,
        handlers::auth::verify_email,
        handlers::auth::forgot_password,
        handlers::auth::reset_password,
        handlers::auth::refresh_token,
        handlers::auth::get_session,
        handlers::auth::sign_out,
        handlers::auth::send_verification_email,
        handlers::auth::change_password,
        handlers::auth::update_user,
        handlers::auth::jwks,
    ),
    components(schemas(
        schemas::auth::SignUpDto,
        schemas::auth::SignInDto,
        schemas::auth::VerifyEmailQuery,
        schemas::auth::ForgotPasswordDto,
        schemas::auth::ResetPasswordDto,
        schemas::auth::RefreshTokenDto,
        schemas::auth::AuthDto,
        schemas::auth::UserDto,
        schemas::auth::MessageDto,
        schemas::auth::SendVerificationEmailDto,
        schemas::auth::ChangePasswordDto,
        schemas::auth::ChangePasswordResponseDto,
        schemas::auth::UpdateUserDto,
        snapflow_models::SystemRole,
    ))
)]
pub struct Api;

pub fn public_router() -> Router<AppState> {
    Router::default()
        .route("/auth/sign-up", post(handlers::auth::sign_up))
        .route("/auth/sign-in", post(handlers::auth::sign_in))
        .route("/auth/refresh", post(handlers::auth::refresh_token))
        .route("/auth/verify-email", get(handlers::auth::verify_email))
        .route(
            "/auth/forgot-password",
            post(handlers::auth::forgot_password),
        )
        .route("/auth/reset-password", post(handlers::auth::reset_password))
        .route(
            "/auth/send-verification-email",
            post(handlers::auth::send_verification_email),
        )
        .route("/.well-known/jwks.json", get(handlers::auth::jwks))
}

pub fn protected_router() -> Router<AppState> {
    Router::default()
        .route("/auth/session", get(handlers::auth::get_session))
        .route("/auth/sign-out", post(handlers::auth::sign_out))
        .route(
            "/auth/change-password",
            post(handlers::auth::change_password),
        )
        .route("/auth/update-user", post(handlers::auth::update_user))
}
