// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::User;
use crate::repositories;
use snapflow_errors::{AppError, Result};
use snapflow_models::SystemRole;

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<User> {
    repositories::user::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("user not found".into()))
}

pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<User>> {
    Ok(repositories::user::find_by_email(pool, email).await?)
}

pub async fn find_all(pool: &PgPool) -> Result<Vec<User>> {
    Ok(repositories::user::find_all(pool).await?)
}

pub async fn find_by_ids(pool: &PgPool, ids: &[Uuid]) -> Result<Vec<User>> {
    Ok(repositories::user::find_by_ids(pool, ids).await?)
}

pub async fn update_name(pool: &PgPool, id: Uuid, name: &str) -> Result<User> {
    Ok(repositories::user::update_name(pool, id, name).await?)
}

pub async fn update_email(pool: &PgPool, id: Uuid, email: &str) -> Result<User> {
    Ok(repositories::user::update_email(pool, id, email).await?)
}

pub async fn update_role(pool: &PgPool, id: Uuid, role: SystemRole) -> Result<User> {
    Ok(repositories::user::update_role(pool, id, role).await?)
}

pub async fn verify_email(pool: &PgPool, id: Uuid) -> Result<User> {
    let user = repositories::user::set_email_verified(pool, id, true).await?;
    repositories::organization::unsuspend_personal(pool, id).await?;
    Ok(user)
}

pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()> {
    repositories::organization::delete_personal(pool, id).await?;
    repositories::organization::remove_user_from_all_non_personal(pool, id).await?;
    repositories::user::delete(pool, id).await?;
    Ok(())
}
