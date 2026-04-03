// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashSet;

use rand::Rng;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use redis::AsyncCommands;

use crate::constants::auth as auth_constants;
use crate::infra::Infra;
use crate::models::ApiKey;
use crate::repositories;
use crate::schemas::api_key::{ApiKeyCreatedDto, ApiKeyDto};
use crate::schemas::organization::parse_permissions;
use snapflow_errors::{AppError, Result};
use snapflow_models::{OrganizationMemberRole, OrganizationResourcePermission, SystemRole};

pub async fn create(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    name: &str,
    requested_permissions: &[String],
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
) -> Result<ApiKeyCreatedDto> {
    if repositories::api_key::find_by_name(pool, org_id, user_id, name)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict(
            "an API key with this name already exists".into(),
        ));
    }

    let raw_key = generate_key();
    let key_hash = hash_key(&raw_key);
    let key_prefix = &raw_key[auth_constants::API_KEY_PREFIX.len()
        ..auth_constants::API_KEY_PREFIX.len() + auth_constants::API_KEY_FRAGMENT_LENGTH];
    let key_suffix = &raw_key[raw_key.len() - auth_constants::API_KEY_FRAGMENT_LENGTH..];

    let api_key = repositories::api_key::create(
        pool,
        &repositories::api_key::CreateApiKeyParams {
            org_id,
            user_id,
            name,
            key_hash: &key_hash,
            key_prefix,
            key_suffix,
            permissions: requested_permissions,
            expires_at,
        },
    )
    .await?;

    Ok(ApiKeyCreatedDto {
        name: api_key.name,
        value: raw_key,
        permissions: parse_permissions(&api_key.permissions),
        created_at: api_key.created_at,
        expires_at: api_key.expires_at,
    })
}

pub async fn find_all(pool: &PgPool, org_id: Uuid, user_id: Uuid) -> Result<Vec<ApiKeyDto>> {
    let keys = repositories::api_key::find_by_org_and_user(pool, org_id, user_id).await?;
    let user_perms = get_effective_permission_set(pool, org_id, user_id).await?;

    Ok(keys
        .iter()
        .map(|k| {
            let mut resp = ApiKeyDto::from_api_key(k);
            resp.permissions = filter_permissions(&k.permissions, &user_perms);
            resp
        })
        .collect())
}

pub async fn find_by_name(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    name: &str,
) -> Result<ApiKeyDto> {
    let key = repositories::api_key::find_by_name(pool, org_id, user_id, name)
        .await?
        .ok_or(AppError::NotFound("API key not found".into()))?;

    let user_perms = get_effective_permission_set(pool, org_id, user_id).await?;

    let mut resp = ApiKeyDto::from_api_key(&key);
    resp.permissions = filter_permissions(&key.permissions, &user_perms);
    Ok(resp)
}

pub async fn find_current(pool: &PgPool, api_key: &ApiKey) -> Result<ApiKeyDto> {
    let user_perms =
        get_effective_permission_set(pool, api_key.organization_id, api_key.user_id).await?;

    let mut resp = ApiKeyDto::from_api_key(api_key);
    resp.permissions = filter_permissions(&api_key.permissions, &user_perms);
    Ok(resp)
}

pub async fn delete(infra: &Infra, org_id: Uuid, user_id: Uuid, name: &str) -> Result<()> {
    let api_key = repositories::api_key::find_by_name(&infra.pool, org_id, user_id, name)
        .await?
        .ok_or(AppError::NotFound("API key not found".into()))?;

    repositories::api_key::delete(&infra.pool, org_id, user_id, name).await?;

    let cache_key = format!("api-key:validation:{}", api_key.key_hash);
    let _: std::result::Result<(), _> = infra.redis.clone().del(cache_key).await;

    Ok(())
}

pub async fn validate_permissions(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    requested: &[String],
    role: SystemRole,
) -> Result<()> {
    if role == SystemRole::Admin {
        return Ok(());
    }

    let org_user = repositories::organization_user::find_one(pool, org_id, user_id)
        .await?
        .ok_or(AppError::NotFound("organization member not found".into()))?;

    if org_user.role == OrganizationMemberRole::Owner {
        return Ok(());
    }

    let user_perms = get_user_role_permissions(pool, org_id, user_id).await?;
    let user_perm_set: HashSet<&str> = user_perms.iter().map(|s| s.as_str()).collect();

    for perm in requested {
        if !user_perm_set.contains(perm.as_str()) {
            return Err(AppError::Forbidden(format!(
                "you do not have the '{perm}' permission to grant"
            )));
        }
    }

    Ok(())
}

async fn get_effective_permission_set(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
) -> Result<Option<HashSet<String>>> {
    let org_user = repositories::organization_user::find_one(pool, org_id, user_id).await?;

    let Some(org_user) = org_user else {
        return Ok(None);
    };

    if org_user.role == OrganizationMemberRole::Owner {
        return Ok(None);
    }

    let perms = get_user_role_permissions(pool, org_id, user_id).await?;
    Ok(Some(perms.into_iter().collect()))
}

fn filter_permissions(
    key_permissions: &[String],
    user_perm_set: &Option<HashSet<String>>,
) -> Vec<OrganizationResourcePermission> {
    let filtered: Vec<&String> = match user_perm_set {
        Some(allowed) => key_permissions
            .iter()
            .filter(|p| allowed.contains(p.as_str()))
            .collect(),
        None => key_permissions.iter().collect(),
    };

    filtered.iter().filter_map(|p| p.parse().ok()).collect()
}

async fn get_user_role_permissions(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<String>> {
    let rows =
        repositories::organization_user::find_user_permissions(pool, org_id, user_id).await?;

    Ok(rows)
}

fn generate_key() -> String {
    let bytes: [u8; 32] = rand::rng().random();
    format!("{}{}", auth_constants::API_KEY_PREFIX, hex::encode(bytes))
}

fn hash_key(key: &str) -> String {
    hex::encode(Sha256::digest(key.as_bytes()))
}
