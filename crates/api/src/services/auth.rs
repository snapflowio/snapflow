// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use argon2::password_hash::SaltString;
use argon2::password_hash::rand_core::OsRng;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use chrono::{Duration, Utc};
use rand::Rng;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::constants::auth as auth_constants;
use crate::constants::providers;
use crate::infra::Infra;
use crate::models::{RefreshToken, User};
use crate::repositories;
use snapflow_auth::jwt::REFRESH_TOKEN_EXPIRY_DAYS;
use snapflow_errors::{AppError, Result};
use snapflow_models::{OrganizationMemberRole, SystemRole};

pub struct SignUpResult {
    pub user: User,
    pub refresh_token: Option<String>,
}

pub struct SignInResult {
    pub user: User,
    pub refresh_token: Option<String>,
}

pub struct SignUpParams<'a> {
    pub name: &'a str,
    pub email: &'a str,
    pub password: &'a str,
    pub ip_address: Option<&'a str>,
    pub user_agent: Option<&'a str>,
}

pub async fn sign_up(infra: &Infra, params: &SignUpParams<'_>) -> Result<SignUpResult> {
    if repositories::user::find_by_email(&infra.pool, params.email)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict("email already registered".into()));
    }

    let password_hash = hash_password(params.password)?;

    let mut tx = infra.pool.begin().await?;

    let user =
        repositories::user::create(&mut *tx, params.name, params.email, SystemRole::User).await?;
    repositories::account::create_email_account(&mut *tx, user.id, &password_hash).await?;
    let org =
        repositories::organization::create_personal(&mut *tx, user.id, &infra.config.quota).await?;
    repositories::organization_user::create(
        &mut *tx,
        org.id,
        user.id,
        OrganizationMemberRole::Owner,
    )
    .await?;

    tx.commit().await?;

    let token = create_verification_token(&infra.pool, &user.email).await?;
    let url = format!(
        "{}/api/auth/verify-email?token={}&identifier={}",
        infra.config.api_url, token, user.email
    );
    let mail = infra.mail.clone();
    let user_name = user.name.clone();
    let user_email = user.email.clone();
    tokio::spawn(async move {
        mail.send_verification_email(&user_email, &user_name, &url)
            .await;
    });

    let refresh_token =
        create_refresh_token(&infra.pool, user.id, params.ip_address, params.user_agent).await?;

    Ok(SignUpResult {
        user,
        refresh_token: Some(refresh_token),
    })
}

pub async fn sign_in(
    pool: &PgPool,
    email: &str,
    raw_password: &str,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) -> Result<SignInResult> {
    let user = repositories::user::find_by_email(pool, email)
        .await?
        .ok_or(AppError::Unauthorized("invalid credentials".into()))?;

    if user.banned {
        return Err(AppError::Forbidden("account is banned".into()));
    }

    let account =
        repositories::account::find_by_user_id_and_provider(pool, user.id, providers::EMAIL)
            .await?
            .ok_or(AppError::Unauthorized("invalid credentials".into()))?;

    let stored_hash = account
        .password
        .ok_or(AppError::Unauthorized("invalid credentials".into()))?;
    if !verify_password(raw_password, &stored_hash) {
        return Err(AppError::Unauthorized("invalid credentials".into()));
    }

    if !user.email_verified {
        return Err(AppError::Forbidden(
            "please verify your email address".into(),
        ));
    }

    let refresh_token = create_refresh_token(pool, user.id, ip_address, user_agent).await?;

    Ok(SignInResult {
        user,
        refresh_token: Some(refresh_token),
    })
}

pub async fn verify_email(pool: &PgPool, identifier: &str, token: &str) -> Result<()> {
    let verification =
        repositories::verification::find_by_identifier_and_value(pool, identifier, token)
            .await?
            .ok_or(AppError::BadRequest(
                "invalid or expired verification token".into(),
            ))?;

    let user = repositories::user::find_by_email(pool, &verification.identifier)
        .await?
        .ok_or(AppError::NotFound("user not found".into()))?;

    repositories::user::set_email_verified(pool, user.id, true).await?;
    repositories::verification::delete_by_id(pool, verification.id).await?;
    repositories::organization::unsuspend_personal(pool, user.id).await?;

    Ok(())
}

pub async fn forgot_password(infra: &Infra, email: &str) -> Result<()> {
    let Some(user) = repositories::user::find_by_email(&infra.pool, email).await? else {
        return Ok(());
    };

    let token = generate_secure_token();
    let token_hash = hex::encode(Sha256::digest(token.as_bytes()));
    let identifier = format!("reset-password:{token_hash}");
    let expires_at = Utc::now() + Duration::hours(1);
    repositories::verification::create(&infra.pool, &identifier, &user.email, expires_at).await?;

    let url = format!(
        "{}/reset-password?token={}",
        infra.config.website_url, token
    );
    let mail = infra.mail.clone();
    let user_name = user.name.clone();
    let user_email = user.email.clone();
    tokio::spawn(async move {
        mail.send_password_reset_email(&user_email, &user_name, &url)
            .await;
    });

    Ok(())
}

pub async fn reset_password(pool: &PgPool, token: &str, new_password: &str) -> Result<()> {
    let token_hash = hex::encode(Sha256::digest(token.as_bytes()));
    let identifier = format!("reset-password:{token_hash}");

    let verification = repositories::verification::find_and_delete_by_identifier(pool, &identifier)
        .await?
        .ok_or(AppError::BadRequest(
            "invalid or expired reset token".into(),
        ))?;

    let user = repositories::user::find_by_email(pool, &verification.value)
        .await?
        .ok_or(AppError::NotFound("user not found".into()))?;

    let password_hash = hash_password(new_password)?;
    repositories::account::update_password(pool, user.id, &password_hash).await?;

    Ok(())
}

pub async fn send_verification_email(infra: &Infra, email: &str) -> Result<()> {
    let Some(user) = repositories::user::find_by_email(&infra.pool, email).await? else {
        return Ok(());
    };

    if user.email_verified {
        return Ok(());
    }

    let token = create_verification_token(&infra.pool, &user.email).await?;
    let url = format!(
        "{}/api/auth/verify-email?token={}&identifier={}",
        infra.config.api_url, token, user.email
    );
    let mail = infra.mail.clone();
    let user_name = user.name.clone();
    let user_email = user.email.clone();
    tokio::spawn(async move {
        mail.send_verification_email(&user_email, &user_name, &url)
            .await;
    });

    Ok(())
}

pub async fn change_password(
    pool: &PgPool,
    user_id: Uuid,
    current_password: &str,
    new_password: &str,
) -> Result<()> {
    let account =
        repositories::account::find_by_user_id_and_provider(pool, user_id, providers::EMAIL)
            .await?
            .ok_or(AppError::BadRequest("no email account found".into()))?;

    let stored_hash = account
        .password
        .ok_or(AppError::BadRequest("no password set".into()))?;
    if !verify_password(current_password, &stored_hash) {
        return Err(AppError::BadRequest("invalid current password".into()));
    }

    let password_hash = hash_password(new_password)?;
    repositories::account::update_password(pool, user_id, &password_hash).await?;

    Ok(())
}

pub async fn update_user_name(pool: &PgPool, user_id: Uuid, name: &str) -> Result<User> {
    repositories::user::update_name(pool, user_id, name)
        .await
        .map_err(|e| AppError::Internal(format!("failed to update user: {e}")))
}

pub async fn get_session_user(pool: &PgPool, user_id: Uuid) -> Result<User> {
    repositories::user::find_by_id(pool, user_id)
        .await?
        .ok_or(AppError::NotFound("user not found".into()))
}

fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(format!("password hash failed: {e}")))
}

fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

async fn create_verification_token(pool: &PgPool, identifier: &str) -> Result<String> {
    let token = generate_secure_token();
    let expires_at = Utc::now() + Duration::hours(auth_constants::VERIFICATION_EXPIRY_HOURS);
    repositories::verification::create(pool, identifier, &token, expires_at).await?;
    Ok(token)
}

fn generate_secure_token() -> String {
    let bytes: [u8; 32] = rand::rng().random();
    hex::encode(bytes)
}

pub async fn create_refresh_token_public(
    pool: &PgPool,
    user_id: Uuid,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) -> Result<String> {
    create_refresh_token(pool, user_id, ip_address, user_agent).await
}

async fn create_refresh_token(
    pool: &PgPool,
    user_id: Uuid,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) -> Result<String> {
    let token = generate_secure_token();
    let token_hash = hex::encode(Sha256::digest(token.as_bytes()));
    let jti = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::days(REFRESH_TOKEN_EXPIRY_DAYS);

    repositories::refresh_token::create(
        pool,
        user_id,
        &token_hash,
        &jti,
        ip_address,
        user_agent,
        expires_at,
    )
    .await?;

    Ok(token)
}

pub async fn verify_refresh_token(pool: &PgPool, token: &str) -> Result<RefreshToken> {
    let token_hash = hex::encode(Sha256::digest(token.as_bytes()));
    repositories::refresh_token::find_by_token_hash(pool, &token_hash)
        .await?
        .ok_or(AppError::Unauthorized("invalid refresh token".into()))
}

pub async fn revoke_refresh_token(pool: &PgPool, token: &str) -> Result<()> {
    let token_hash = hex::encode(Sha256::digest(token.as_bytes()));
    repositories::refresh_token::revoke_by_token_hash(pool, &token_hash).await?;
    Ok(())
}

pub async fn revoke_all_user_tokens(pool: &PgPool, user_id: Uuid) -> Result<()> {
    repositories::refresh_token::revoke_all_for_user(pool, user_id).await?;
    Ok(())
}

pub async fn blacklist_jwt(
    redis: &mut ::redis::aio::ConnectionManager,
    jti: &str,
    expires_in_secs: i64,
) -> Result<()> {
    use ::redis::AsyncCommands;

    let blacklist_key = format!("jwt:blacklist:{jti}");
    let _: () = redis
        .set_ex(&blacklist_key, "1", expires_in_secs as u64)
        .await
        .map_err(|e| AppError::Internal(format!("failed to blacklist token: {e}")))?;
    Ok(())
}
