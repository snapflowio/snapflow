// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::constants::org as org_constants;
use crate::models::OrganizationInvitation;
use crate::repositories;
use crate::schemas::organization::{
    OrganizationInvitationDto, OrganizationRoleDto, parse_permissions,
};
use snapflow_errors::{AppError, Result};
use snapflow_models::{OrganizationInvitationStatus, OrganizationMemberRole};

pub async fn create(
    pool: &PgPool,
    org_id: Uuid,
    email: &str,
    invited_by: &str,
    role: OrganizationMemberRole,
    assigned_role_ids: Option<&[Uuid]>,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
) -> Result<OrganizationInvitation> {
    let org = repositories::organization::find_by_id(pool, org_id)
        .await?
        .ok_or(AppError::NotFound("organization not found".into()))?;

    if org.personal {
        return Err(AppError::BadRequest(
            "cannot invite users to a personal organization".into(),
        ));
    }

    let email = email.to_lowercase();
    let email = email.trim();

    let user_by_email = repositories::user::find_by_email(pool, email).await?;
    if let Some(user) = &user_by_email
        && repositories::organization_user::find_one(pool, org_id, user.id)
            .await?
            .is_some()
    {
        return Err(AppError::Conflict(
            "user is already a member of this organization".into(),
        ));
    }

    if repositories::organization_invitation::find_pending_by_org_and_email(pool, org_id, email)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict(
            "a pending invitation already exists for this email".into(),
        ));
    }

    let expires = expires_at.unwrap_or_else(|| {
        Utc::now() + Duration::days(org_constants::DEFAULT_INVITATION_EXPIRY_DAYS)
    });

    if let Some(role_ids) = assigned_role_ids
        && !role_ids.is_empty()
    {
        let found = repositories::organization_role::find_by_ids(pool, role_ids).await?;
        if found.len() != role_ids.len() {
            return Err(AppError::BadRequest(
                "one or more role IDs are invalid".into(),
            ));
        }
    }

    let invitation = repositories::organization_invitation::create(
        pool, org_id, email, invited_by, role, expires,
    )
    .await?;

    if let Some(role_ids) = assigned_role_ids {
        for role_id in role_ids {
            repositories::organization_invitation::assign_role(pool, invitation.id, *role_id)
                .await?;
        }
    }

    Ok(invitation)
}

pub async fn find_pending_by_org(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<Vec<OrganizationInvitation>> {
    Ok(repositories::organization_invitation::find_pending_by_org(pool, org_id).await?)
}

pub async fn find_by_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<OrganizationInvitation>> {
    let user = repositories::user::find_by_id(pool, user_id)
        .await?
        .ok_or(AppError::NotFound("user not found".into()))?;

    Ok(repositories::organization_invitation::find_pending_by_email(pool, &user.email).await?)
}

pub async fn get_count_by_user(pool: &PgPool, user_id: Uuid) -> Result<i64> {
    let user = repositories::user::find_by_id(pool, user_id)
        .await?
        .ok_or(AppError::NotFound("user not found".into()))?;

    Ok(repositories::organization_invitation::count_pending_by_email(pool, &user.email).await?)
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    role: OrganizationMemberRole,
    assigned_role_ids: Option<&[Uuid]>,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
) -> Result<OrganizationInvitation> {
    let invitation = repositories::organization_invitation::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("invitation not found".into()))?;

    if invitation.status != OrganizationInvitationStatus::Pending {
        return Err(AppError::BadRequest(
            "can only update pending invitations".into(),
        ));
    }

    if invitation.expires_at < Utc::now() {
        return Err(AppError::BadRequest("invitation has expired".into()));
    }

    if let Some(role_ids) = assigned_role_ids
        && !role_ids.is_empty()
    {
        let found = repositories::organization_role::find_by_ids(pool, role_ids).await?;
        if found.len() != role_ids.len() {
            return Err(AppError::BadRequest(
                "one or more role IDs are invalid".into(),
            ));
        }

        let mut tx = pool.begin().await?;
        repositories::organization_invitation::clear_assigned_roles(&mut *tx, id).await?;
        for role_id in role_ids {
            repositories::organization_invitation::assign_role(&mut *tx, id, *role_id).await?;
        }
        tx.commit().await?;
    }

    Ok(repositories::organization_invitation::update(pool, id, role, expires_at).await?)
}

pub async fn accept(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<()> {
    let invitation = repositories::organization_invitation::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("invitation not found".into()))?;

    if invitation.status != OrganizationInvitationStatus::Pending {
        return Err(AppError::BadRequest(
            "can only accept pending invitations".into(),
        ));
    }

    if invitation.expires_at < Utc::now() {
        return Err(AppError::BadRequest("invitation has expired".into()));
    }

    let user = repositories::user::find_by_id(pool, user_id)
        .await?
        .ok_or(AppError::NotFound("user not found".into()))?;

    if user.email != invitation.email {
        return Err(AppError::Forbidden(
            "invitation is for a different email address".into(),
        ));
    }

    let mut tx = pool.begin().await?;

    repositories::organization_invitation::update_status(
        &mut *tx,
        id,
        OrganizationInvitationStatus::Accepted,
    )
    .await?;

    repositories::organization_user::create(
        &mut *tx,
        invitation.organization_id,
        user_id,
        invitation.role,
    )
    .await?;

    let assigned_role_ids =
        repositories::organization_invitation::find_assigned_role_ids(&mut *tx, id).await?;

    for role_id in &assigned_role_ids {
        repositories::organization_user::assign_role(
            &mut *tx,
            invitation.organization_id,
            user_id,
            *role_id,
        )
        .await?;
    }

    tx.commit().await?;

    Ok(())
}

pub async fn decline(pool: &PgPool, id: Uuid) -> Result<()> {
    let invitation = repositories::organization_invitation::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("invitation not found".into()))?;

    if invitation.status != OrganizationInvitationStatus::Pending {
        return Err(AppError::BadRequest(
            "can only decline pending invitations".into(),
        ));
    }

    repositories::organization_invitation::update_status(
        pool,
        id,
        OrganizationInvitationStatus::Declined,
    )
    .await?;
    Ok(())
}

pub async fn cancel(pool: &PgPool, id: Uuid) -> Result<()> {
    let invitation = repositories::organization_invitation::find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("invitation not found".into()))?;

    if invitation.status != OrganizationInvitationStatus::Pending {
        return Err(AppError::BadRequest(
            "can only cancel pending invitations".into(),
        ));
    }

    repositories::organization_invitation::update_status(
        pool,
        id,
        OrganizationInvitationStatus::Cancelled,
    )
    .await?;
    Ok(())
}

pub async fn to_response(
    pool: &PgPool,
    inv: &OrganizationInvitation,
) -> Result<OrganizationInvitationDto> {
    let org_name =
        repositories::organization_invitation::find_org_name(pool, inv.organization_id).await?;

    let assigned_roles =
        repositories::organization_invitation::find_assigned_roles(pool, inv.id).await?;

    Ok(OrganizationInvitationDto {
        id: inv.id,
        email: inv.email.clone(),
        invited_by: inv.invited_by.clone(),
        organization_id: inv.organization_id,
        organization_name: org_name.unwrap_or_default(),
        role: inv.role,
        status: inv.status,
        assigned_roles: assigned_roles
            .iter()
            .map(|r| OrganizationRoleDto {
                id: r.id,
                name: r.name.clone(),
                description: r.description.clone(),
                permissions: parse_permissions(&r.permissions),
                is_global: r.is_global,
                created_at: r.created_at,
                updated_at: r.updated_at,
            })
            .collect(),
        expires_at: inv.expires_at,
        created_at: inv.created_at,
        updated_at: inv.updated_at,
    })
}
