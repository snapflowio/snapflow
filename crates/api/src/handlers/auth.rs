// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};

use crate::extractors::auth::SessionAuth;
use crate::extractors::validated_json::ValidatedJson;
use crate::schemas::auth::{
    AuthDto, ChangePasswordDto, ChangePasswordResponseDto, ForgotPasswordDto, MessageDto,
    RefreshTokenDto, ResetPasswordDto, SendVerificationEmailDto, SignInDto, SignUpDto,
    UpdateUserDto, UserDto, VerifyEmailQuery,
};
use crate::services;
use crate::state::AppState;
use crate::utils::cookies;
use snapflow_errors::Result;

#[utoipa::path(
    post,
    path = "/auth/sign-up",
    tag = "auth",
    operation_id = "signUp",
    summary = "Sign up",
    request_body = SignUpDto,
    responses(
        (status = 201, description = "User created successfully.", body = AuthDto),
        (status = 400, description = "Validation error."),
        (status = 409, description = "Email already exists."),
    )
)]
pub async fn sign_up(
    State(state): State<AppState>,
    headers: HeaderMap,
    ValidatedJson(body): ValidatedJson<SignUpDto>,
) -> Result<Response> {
    let (ip, ua) = extract_client_info(&headers);

    let result = services::auth::sign_up(
        &state.infra,
        &services::auth::SignUpParams {
            name: &body.name,
            email: &body.email,
            password: &body.password,
            ip_address: ip.as_deref(),
            user_agent: ua.as_deref(),
        },
    )
    .await?;

    let token = state
        .infra
        .jwt
        .sign(result.user.id, &result.user.email, result.user.role)?;

    let is_production = state.infra.config.is_production();
    let mut response_headers = HeaderMap::default();

    // Set httpOnly cookies for tokens
    let _ = cookies::set_access_token_cookie(&mut response_headers, &token, is_production);
    if let Some(ref refresh_token) = result.refresh_token {
        let _ =
            cookies::set_refresh_token_cookie(&mut response_headers, refresh_token, is_production);
    }

    let auth_response = AuthDto {
        user: UserDto::from(&result.user),
        token: token.clone(),
        refresh_token: result.refresh_token.clone(),
    };

    let mut response = (StatusCode::CREATED, Json(auth_response)).into_response();
    response.headers_mut().extend(response_headers);
    Ok(response)
}

#[utoipa::path(
    post,
    path = "/auth/sign-in",
    tag = "auth",
    operation_id = "signIn",
    summary = "Sign in",
    request_body = SignInDto,
    responses(
        (status = 200, description = "Signed in successfully.", body = AuthDto),
        (status = 401, description = "Invalid credentials."),
        (status = 403, description = "Email not verified or banned."),
    )
)]
pub async fn sign_in(
    State(state): State<AppState>,
    req_headers: HeaderMap,
    ValidatedJson(body): ValidatedJson<SignInDto>,
) -> Result<Response> {
    let (ip, ua) = extract_client_info(&req_headers);

    let result = services::auth::sign_in(
        &state.infra.pool,
        &body.email,
        &body.password,
        ip.as_deref(),
        ua.as_deref(),
    )
    .await?;

    let token = state
        .infra
        .jwt
        .sign(result.user.id, &result.user.email, result.user.role)?;

    let is_production = state.infra.config.is_production();
    let mut response_headers = HeaderMap::default();

    // Set httpOnly cookies for tokens
    let _ = cookies::set_access_token_cookie(&mut response_headers, &token, is_production);
    if let Some(ref refresh_token) = result.refresh_token {
        let _ =
            cookies::set_refresh_token_cookie(&mut response_headers, refresh_token, is_production);
    }

    let auth_response = AuthDto {
        user: UserDto::from(&result.user),
        token: token.clone(),
        refresh_token: result.refresh_token.clone(),
    };

    let mut response = Json(auth_response).into_response();
    response.headers_mut().extend(response_headers);
    Ok(response)
}

#[utoipa::path(
    get,
    path = "/auth/verify-email",
    tag = "auth",
    operation_id = "verifyEmail",
    summary = "Verify email address",
    params(
        ("token" = String, Query, description = "Verification token"),
        ("identifier" = String, Query, description = "Email address"),
    ),
    responses(
        (status = 302, description = "Redirects to dashboard."),
        (status = 400, description = "Invalid or expired token."),
    )
)]
pub async fn verify_email(
    State(state): State<AppState>,
    Query(params): Query<VerifyEmailQuery>,
) -> Result<axum::response::Redirect> {
    services::auth::verify_email(&state.infra.pool, &params.identifier, &params.token).await?;

    Ok(axum::response::Redirect::temporary(
        &state.infra.config.dashboard_url,
    ))
}

#[utoipa::path(
    post,
    path = "/auth/forgot-password",
    tag = "auth",
    operation_id = "forgotPassword",
    summary = "Request password reset",
    request_body = ForgotPasswordDto,
    responses(
        (status = 200, description = "Reset email sent if account exists.", body = MessageDto),
    )
)]
pub async fn forgot_password(
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<ForgotPasswordDto>,
) -> Result<Json<MessageDto>> {
    services::auth::forgot_password(&state.infra, &body.email).await?;

    Ok(Json(MessageDto {
        message: "if an account with that email exists, a password reset link has been sent".into(),
    }))
}

#[utoipa::path(
    post,
    path = "/auth/reset-password",
    tag = "auth",
    operation_id = "resetPassword",
    summary = "Reset password",
    request_body = ResetPasswordDto,
    responses(
        (status = 200, description = "Password reset successfully.", body = MessageDto),
        (status = 400, description = "Invalid or expired token."),
    )
)]
pub async fn reset_password(
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<ResetPasswordDto>,
) -> Result<Json<MessageDto>> {
    services::auth::reset_password(&state.infra.pool, &body.token, &body.new_password).await?;

    Ok(Json(MessageDto {
        message: "password reset successfully".into(),
    }))
}

#[utoipa::path(
    get,
    path = "/auth/session",
    tag = "auth",
    operation_id = "getSession",
    summary = "Get current session",
    responses(
        (status = 200, description = "Current session user.", body = UserDto),
        (status = 401, description = "Not authenticated."),
    ),
    security(("bearer" = []))
)]
pub async fn get_session(ctx: SessionAuth, State(state): State<AppState>) -> Result<Json<UserDto>> {
    let user = services::auth::get_session_user(&state.infra.pool, ctx.auth.user_id).await?;
    Ok(Json(UserDto::from(&user)))
}

#[utoipa::path(
    post,
    path = "/auth/sign-out",
    tag = "auth",
    operation_id = "signOut",
    summary = "Sign out",
    responses(
        (status = 200, description = "Signed out successfully.", body = MessageDto),
    ),
    security(("bearer" = []))
)]
pub async fn sign_out(
    ctx: SessionAuth,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response> {
    // Blacklist the current JWT — check both Authorization header and cookie
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(String::from)
        .or_else(|| cookies::get_access_token(&headers));

    if let Some(token) = token {
        if let Ok(claims) = state.infra.jwt.verify(&token) {
            let now = chrono::Utc::now().timestamp();
            let remaining = (claims.exp - now).max(0);
            let _ = services::auth::blacklist_jwt(
                &mut state.infra.redis.clone(),
                &claims.jti,
                remaining,
            )
            .await;
        }
    }

    // Revoke all refresh tokens for the user
    let _ = services::auth::revoke_all_user_tokens(&state.infra.pool, ctx.auth.user_id).await;

    let is_production = state.infra.config.is_production();
    let mut response_headers = HeaderMap::default();

    // Clear httpOnly cookies
    let _ = cookies::clear_access_token_cookie(&mut response_headers, is_production);
    let _ = cookies::clear_refresh_token_cookie(&mut response_headers, is_production);

    let message_response = MessageDto {
        message: "signed out".into(),
    };

    let mut response = Json(message_response).into_response();
    response.headers_mut().extend(response_headers);
    Ok(response)
}

#[utoipa::path(
    post,
    path = "/auth/refresh",
    tag = "auth",
    operation_id = "refreshToken",
    summary = "Refresh access token",
    request_body = RefreshTokenDto,
    responses(
        (status = 200, description = "Token refreshed successfully.", body = AuthDto),
        (status = 401, description = "Invalid or expired refresh token."),
    )
)]
pub async fn refresh_token(State(state): State<AppState>, headers: HeaderMap) -> Result<Response> {
    let old_refresh_token = cookies::get_refresh_token(&headers)
        .ok_or_else(|| snapflow_errors::AppError::BadRequest("refresh token required".into()))?;

    let refresh_token_data =
        services::auth::verify_refresh_token(&state.infra.pool, &old_refresh_token).await?;

    let user =
        services::auth::get_session_user(&state.infra.pool, refresh_token_data.user_id).await?;

    let token = state.infra.jwt.sign(user.id, &user.email, user.role)?;

    // Rotate: revoke old refresh token and issue a new one
    let _ = services::auth::revoke_refresh_token(&state.infra.pool, &old_refresh_token).await;
    let (ip, ua) = extract_client_info(&headers);
    let new_refresh_token = services::auth::create_refresh_token_public(
        &state.infra.pool,
        user.id,
        ip.as_deref(),
        ua.as_deref(),
    )
    .await?;

    let is_production = state.infra.config.is_production();
    let mut response_headers = HeaderMap::default();

    let _ = cookies::set_access_token_cookie(&mut response_headers, &token, is_production);
    let _ =
        cookies::set_refresh_token_cookie(&mut response_headers, &new_refresh_token, is_production);

    let auth_response = AuthDto {
        user: UserDto::from(&user),
        token: token.clone(),
        refresh_token: Some(new_refresh_token),
    };

    let mut response = Json(auth_response).into_response();
    response.headers_mut().extend(response_headers);
    Ok(response)
}

#[utoipa::path(
    post,
    path = "/auth/send-verification-email",
    tag = "auth",
    operation_id = "sendVerificationEmail",
    summary = "Resend verification email",
    request_body = SendVerificationEmailDto,
    responses(
        (status = 200, description = "Verification email sent if applicable.", body = MessageDto),
    )
)]
pub async fn send_verification_email(
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<SendVerificationEmailDto>,
) -> Result<Json<MessageDto>> {
    services::auth::send_verification_email(&state.infra, &body.email).await?;

    Ok(Json(MessageDto {
        message: "if the email is registered and unverified, a verification email has been sent"
            .into(),
    }))
}

#[utoipa::path(
    post,
    path = "/auth/change-password",
    tag = "auth",
    operation_id = "changePassword",
    summary = "Change password",
    request_body = ChangePasswordDto,
    responses(
        (status = 200, description = "Password changed.", body = ChangePasswordResponseDto),
        (status = 400, description = "Invalid current password."),
    ),
    security(("bearer" = []))
)]
pub async fn change_password(
    ctx: SessionAuth,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<ChangePasswordDto>,
) -> Result<Json<ChangePasswordResponseDto>> {
    services::auth::change_password(
        &state.infra.pool,
        ctx.auth.user_id,
        &body.current_password,
        &body.new_password,
    )
    .await?;

    Ok(Json(ChangePasswordResponseDto { status: true }))
}

#[utoipa::path(
    post,
    path = "/auth/update-user",
    tag = "auth",
    operation_id = "updateUser",
    summary = "Update user profile",
    request_body = UpdateUserDto,
    responses(
        (status = 200, description = "User updated.", body = UserDto),
    ),
    security(("bearer" = []))
)]
pub async fn update_user(
    ctx: SessionAuth,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<UpdateUserDto>,
) -> Result<Json<UserDto>> {
    let user =
        services::auth::update_user_name(&state.infra.pool, ctx.auth.user_id, &body.name).await?;
    Ok(Json(UserDto::from(&user)))
}

#[utoipa::path(
    get,
    path = "/.well-known/jwks.json",
    tag = "auth",
    operation_id = "getJwks",
    summary = "Get JSON Web Key Set",
    responses(
        (status = 200, description = "JWKS for verifying JWTs."),
    )
)]
pub async fn jwks(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(state.infra.jwt.jwks.clone())
}

fn extract_client_info(headers: &HeaderMap) -> (Option<String>, Option<String>) {
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next_back().unwrap_or(s).trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(String::from)
        });

    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    (ip, ua)
}
