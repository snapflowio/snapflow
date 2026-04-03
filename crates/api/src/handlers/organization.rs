// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;

use crate::extractors::auth::SessionAuth;
use crate::extractors::organization::{OrgAccess, OrganizationContext};
use crate::extractors::validated_json::ValidatedJson;
use crate::schemas::auth::MessageDto;
use crate::schemas::organization::{
    CreateInvitationDto, CreateOrganizationDto, CreateOrganizationRoleDto, OrganizationDto,
    OrganizationInvitationDto, OrganizationRoleDto, OrganizationUserDto, SuspendDto,
    UpdateAssignedRolesDto, UpdateInvitationDto, UpdateMemberRoleDto, UpdateOrganizationRoleDto,
    UpdateQuotaDto, UsageOverviewDto, parse_permissions,
};
use crate::services;
use crate::state::AppState;
use snapflow_errors::{AppError, Result};

#[utoipa::path(
    post,
    path = "/organizations",
    tag = "organizations",
    operation_id = "createOrganization",
    summary = "Create organization",
    request_body = CreateOrganizationDto,
    responses(
        (status = 201, description = "Organization created successfully.", body = OrganizationDto),
    ),
    security(("bearer" = []))
)]
pub async fn create(
    ctx: SessionAuth,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateOrganizationDto>,
) -> Result<(StatusCode, Json<OrganizationDto>)> {
    let user = services::user::find_by_id(&state.infra.pool, ctx.auth.user_id).await?;
    let org = services::organization::create(
        &state.infra.pool,
        &body.name,
        &user,
        &state.infra.config.quota,
    )
    .await?;

    Ok((StatusCode::CREATED, Json(OrganizationDto::from(&org))))
}

#[utoipa::path(
    get,
    path = "/organizations",
    tag = "organizations",
    operation_id = "listOrganizations",
    summary = "List organizations",
    responses(
        (status = 200, description = "List of organizations.", body = Vec<OrganizationDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list(
    ctx: SessionAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<OrganizationDto>>> {
    let orgs = services::organization::find_by_user(&state.infra.pool, ctx.auth.user_id).await?;
    Ok(Json(orgs.iter().map(OrganizationDto::from).collect()))
}

#[utoipa::path(
    get,
    path = "/organizations/{organization_id}",
    tag = "organizations",
    operation_id = "getOrganization",
    summary = "Get organization",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 200, description = "Organization details.", body = OrganizationDto),
    ),
    security(("bearer" = []))
)]
pub async fn get(org_ctx: OrganizationContext) -> Result<Json<OrganizationDto>> {
    Ok(Json(OrganizationDto::from(&org_ctx.organization)))
}

#[utoipa::path(
    delete,
    path = "/organizations/{organization_id}",
    tag = "organizations",
    operation_id = "deleteOrganization",
    summary = "Delete organization",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 204, description = "Organization deleted successfully."),
    ),
    security(("bearer" = []))
)]
pub async fn delete(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<StatusCode> {
    org_ctx.require_owner()?;
    services::organization::delete(&state.infra.pool, org_ctx.organization.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/organizations/{organization_id}/usage",
    tag = "organizations",
    operation_id = "getOrganizationUsageOverview",
    summary = "Get usage overview",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 200, description = "Usage overview.", body = UsageOverviewDto),
    ),
    security(("bearer" = []))
)]
pub async fn usage(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<Json<UsageOverviewDto>> {
    let overview =
        services::organization::get_usage_overview(&state.infra, org_ctx.organization.id).await?;
    Ok(Json(overview))
}

#[utoipa::path(
    patch,
    path = "/organizations/{organization_id}/quota",
    tag = "organizations",
    operation_id = "updateOrganizationQuota",
    summary = "Update organization quota",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    request_body = UpdateQuotaDto,
    responses(
        (status = 200, description = "Organization quota updated successfully.", body = OrganizationDto),
    ),
    security(("bearer" = []))
)]
pub async fn update_quota(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Json(body): Json<UpdateQuotaDto>,
) -> Result<Json<OrganizationDto>> {
    org_ctx.require_admin()?;
    let org =
        services::organization::update_quota(&state.infra.pool, org_ctx.organization.id, &body)
            .await?;
    Ok(Json(OrganizationDto::from(&org)))
}

#[utoipa::path(
    post,
    path = "/organizations/{organization_id}/leave",
    tag = "organizations",
    operation_id = "leaveOrganization",
    summary = "Leave organization",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 204, description = "Left organization successfully."),
    ),
    security(("bearer" = []))
)]
pub async fn leave(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<StatusCode> {
    services::organization_user::delete(
        &state.infra.pool,
        org_ctx.organization.id,
        org_ctx.auth.user_id,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/organizations/{organization_id}/suspend",
    tag = "organizations",
    operation_id = "suspendOrganization",
    summary = "Suspend organization",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    request_body = SuspendDto,
    responses(
        (status = 204, description = "Organization suspended successfully."),
    ),
    security(("bearer" = []))
)]
pub async fn suspend(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<SuspendDto>,
) -> Result<StatusCode> {
    org_ctx.require_admin()?;
    services::organization::suspend(
        &state.infra.pool,
        org_ctx.organization.id,
        Some(&body.reason),
        body.until,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/organizations/{organization_id}/unsuspend",
    tag = "organizations",
    operation_id = "unsuspendOrganization",
    summary = "Unsuspend organization",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 200, description = "Organization unsuspended successfully.", body = OrganizationDto),
    ),
    security(("bearer" = []))
)]
pub async fn unsuspend(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<Json<OrganizationDto>> {
    org_ctx.require_admin()?;
    let org = services::organization::unsuspend(&state.infra.pool, org_ctx.organization.id).await?;
    Ok(Json(OrganizationDto::from(&org)))
}

#[utoipa::path(
    get,
    path = "/organizations/{organization_id}/users",
    tag = "organizations",
    operation_id = "listOrganizationMembers",
    summary = "List organization members",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 200, description = "List of organization members.", body = Vec<OrganizationUserDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list_users(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<Json<Vec<OrganizationUserDto>>> {
    let users =
        services::organization_user::find_all(&state.infra.pool, org_ctx.organization.id).await?;
    Ok(Json(users))
}

#[utoipa::path(
    post,
    path = "/organizations/{organization_id}/users/{user_id}/role",
    tag = "organizations",
    operation_id = "updateRoleForOrganizationMember",
    summary = "Update member role",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
        ("user_id" = Uuid, Path, description = "ID of the user"),
    ),
    request_body = UpdateMemberRoleDto,
    responses(
        (status = 200, description = "Member role updated successfully.", body = OrganizationUserDto),
    ),
    security(("bearer" = []))
)]
pub async fn update_user_role(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path(params): Path<(Uuid, Uuid)>,
    ValidatedJson(body): ValidatedJson<UpdateMemberRoleDto>,
) -> Result<Json<OrganizationUserDto>> {
    org_ctx.require_owner()?;
    let (_, target_user_id) = params;

    if target_user_id == org_ctx.auth.user_id {
        return Err(AppError::Forbidden("cannot update your own role".into()));
    }

    let ou = services::organization_user::update_role(
        &state.infra.pool,
        org_ctx.organization.id,
        target_user_id,
        body.role,
    )
    .await?;

    let user = services::user::find_by_id(&state.infra.pool, target_user_id).await?;
    let assigned = services::organization_user::load_assigned_roles(
        &state.infra.pool,
        org_ctx.organization.id,
        target_user_id,
    )
    .await?;

    Ok(Json(OrganizationUserDto {
        user_id: ou.user_id,
        organization_id: ou.organization_id,
        name: user.name,
        email: user.email,
        role: ou.role,
        assigned_roles: assigned,
        created_at: ou.created_at,
        updated_at: ou.updated_at,
    }))
}

#[utoipa::path(
    post,
    path = "/organizations/{organization_id}/users/{user_id}/assigned-roles",
    tag = "organizations",
    operation_id = "updateAssignedOrganizationRoles",
    summary = "Update assigned roles",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
        ("user_id" = Uuid, Path, description = "ID of the user"),
    ),
    request_body = UpdateAssignedRolesDto,
    responses(
        (status = 200, description = "Assigned roles updated successfully.", body = MessageDto),
    ),
    security(("bearer" = []))
)]
pub async fn update_assigned_roles(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path(params): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateAssignedRolesDto>,
) -> Result<Json<MessageDto>> {
    org_ctx.require_owner()?;
    let (_, target_user_id) = params;

    services::organization_user::update_assigned_roles(
        &state.infra.pool,
        org_ctx.organization.id,
        target_user_id,
        &body.role_ids,
    )
    .await?;

    Ok(Json(MessageDto {
        message: "assigned roles updated".into(),
    }))
}

#[utoipa::path(
    delete,
    path = "/organizations/{organization_id}/users/{user_id}",
    tag = "organizations",
    operation_id = "deleteOrganizationMember",
    summary = "Remove member from organization",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
        ("user_id" = Uuid, Path, description = "ID of the user"),
    ),
    responses(
        (status = 204, description = "Member removed successfully."),
    ),
    security(("bearer" = []))
)]
pub async fn remove_user(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path(params): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    org_ctx.require_owner()?;
    let (_, target_user_id) = params;
    services::organization_user::delete(&state.infra.pool, org_ctx.organization.id, target_user_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/organizations/{organization_id}/roles",
    tag = "organizations",
    operation_id = "listOrganizationRoles",
    summary = "List organization roles",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 200, description = "List of organization roles.", body = Vec<OrganizationRoleDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list_roles(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<Json<Vec<OrganizationRoleDto>>> {
    org_ctx.require_owner()?;
    let roles =
        services::organization_role::find_all(&state.infra.pool, org_ctx.organization.id).await?;
    Ok(Json(
        roles
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
    ))
}

#[utoipa::path(
    post,
    path = "/organizations/{organization_id}/roles",
    tag = "organizations",
    operation_id = "createOrganizationRole",
    summary = "Create organization role",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    request_body = CreateOrganizationRoleDto,
    responses(
        (status = 201, description = "Role created successfully.", body = OrganizationRoleDto),
    ),
    security(("bearer" = []))
)]
pub async fn create_role(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateOrganizationRoleDto>,
) -> Result<(StatusCode, Json<OrganizationRoleDto>)> {
    org_ctx.require_owner()?;

    let perm_strings: Vec<String> = body.permissions.iter().map(|p| p.to_string()).collect();

    let role = services::organization_role::create(
        &state.infra.pool,
        org_ctx.organization.id,
        &body.name,
        &body.description,
        &perm_strings,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(OrganizationRoleDto {
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: parse_permissions(&role.permissions),
            is_global: role.is_global,
            created_at: role.created_at,
            updated_at: role.updated_at,
        }),
    ))
}

#[utoipa::path(
    put,
    path = "/organizations/{organization_id}/roles/{role_id}",
    tag = "organizations",
    operation_id = "updateOrganizationRole",
    summary = "Update organization role",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
        ("role_id" = Uuid, Path, description = "ID of the role"),
    ),
    request_body = UpdateOrganizationRoleDto,
    responses(
        (status = 200, description = "Role updated successfully.", body = OrganizationRoleDto),
    ),
    security(("bearer" = []))
)]
pub async fn update_role(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path(params): Path<(Uuid, Uuid)>,
    ValidatedJson(body): ValidatedJson<UpdateOrganizationRoleDto>,
) -> Result<Json<OrganizationRoleDto>> {
    org_ctx.require_owner()?;
    let (_, role_id) = params;

    let perm_strings: Vec<String> = body.permissions.iter().map(|p| p.to_string()).collect();

    let role = services::organization_role::update(
        &state.infra.pool,
        role_id,
        &body.name,
        &body.description,
        &perm_strings,
    )
    .await?;

    Ok(Json(OrganizationRoleDto {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: parse_permissions(&role.permissions),
        is_global: role.is_global,
        created_at: role.created_at,
        updated_at: role.updated_at,
    }))
}

#[utoipa::path(
    delete,
    path = "/organizations/{organization_id}/roles/{role_id}",
    tag = "organizations",
    operation_id = "deleteOrganizationRole",
    summary = "Delete organization role",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
        ("role_id" = Uuid, Path, description = "ID of the role"),
    ),
    responses(
        (status = 204, description = "Role deleted successfully."),
    ),
    security(("bearer" = []))
)]
pub async fn delete_role(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path(params): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    org_ctx.require_owner()?;
    let (_, role_id) = params;
    services::organization_role::delete(&state.infra.pool, role_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/organizations/invitations",
    tag = "organizations",
    operation_id = "listOrganizationInvitationsForAuthenticatedUser",
    summary = "List invitations for authenticated user",
    responses(
        (status = 200, description = "List of invitations.", body = Vec<OrganizationInvitationDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list_user_invitations(
    ctx: SessionAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<OrganizationInvitationDto>>> {
    let invitations =
        services::organization_invitation::find_by_user(&state.infra.pool, ctx.auth.user_id)
            .await?;
    let mut responses = Vec::with_capacity(invitations.len());
    for inv in &invitations {
        responses
            .push(services::organization_invitation::to_response(&state.infra.pool, inv).await?);
    }
    Ok(Json(responses))
}

#[utoipa::path(
    get,
    path = "/organizations/invitations/count",
    tag = "organizations",
    operation_id = "getOrganizationInvitationsCountForAuthenticatedUser",
    summary = "Get invitation count",
    responses(
        (status = 200, description = "Invitation count.", body = i64),
    ),
    security(("bearer" = []))
)]
pub async fn count_user_invitations(
    ctx: SessionAuth,
    State(state): State<AppState>,
) -> Result<Json<i64>> {
    let count =
        services::organization_invitation::get_count_by_user(&state.infra.pool, ctx.auth.user_id)
            .await?;
    Ok(Json(count))
}

#[utoipa::path(
    post,
    path = "/organizations/invitations/{invitation_id}/accept",
    tag = "organizations",
    operation_id = "acceptOrganizationInvitation",
    summary = "Accept invitation",
    params(
        ("invitation_id" = Uuid, Path, description = "ID of the invitation"),
    ),
    responses(
        (status = 200, description = "Invitation accepted.", body = MessageDto),
    ),
    security(("bearer" = []))
)]
pub async fn accept_invitation(
    ctx: SessionAuth,
    State(state): State<AppState>,
    Path(invitation_id): Path<Uuid>,
) -> Result<Json<MessageDto>> {
    services::organization_invitation::accept(&state.infra.pool, invitation_id, ctx.auth.user_id)
        .await?;
    Ok(Json(MessageDto {
        message: "invitation accepted".into(),
    }))
}

#[utoipa::path(
    post,
    path = "/organizations/invitations/{invitation_id}/decline",
    tag = "organizations",
    operation_id = "declineOrganizationInvitation",
    summary = "Decline invitation",
    params(
        ("invitation_id" = Uuid, Path, description = "ID of the invitation"),
    ),
    responses(
        (status = 200, description = "Invitation declined.", body = MessageDto),
    ),
    security(("bearer" = []))
)]
pub async fn decline_invitation(
    _ctx: SessionAuth,
    State(state): State<AppState>,
    Path(invitation_id): Path<Uuid>,
) -> Result<Json<MessageDto>> {
    services::organization_invitation::decline(&state.infra.pool, invitation_id).await?;
    Ok(Json(MessageDto {
        message: "invitation declined".into(),
    }))
}

#[utoipa::path(
    get,
    path = "/organizations/{organization_id}/invitations",
    tag = "organizations",
    operation_id = "listOrganizationInvitations",
    summary = "List pending invitations",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    responses(
        (status = 200, description = "List of pending invitations.", body = Vec<OrganizationInvitationDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list_org_invitations(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
) -> Result<Json<Vec<OrganizationInvitationDto>>> {
    let invitations = services::organization_invitation::find_pending_by_org(
        &state.infra.pool,
        org_ctx.organization.id,
    )
    .await?;
    let mut responses = Vec::with_capacity(invitations.len());
    for inv in &invitations {
        responses
            .push(services::organization_invitation::to_response(&state.infra.pool, inv).await?);
    }
    Ok(Json(responses))
}

#[utoipa::path(
    post,
    path = "/organizations/{organization_id}/invitations",
    tag = "organizations",
    operation_id = "createOrganizationInvitation",
    summary = "Create invitation",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
    ),
    request_body = CreateInvitationDto,
    responses(
        (status = 201, description = "Invitation created successfully.", body = OrganizationInvitationDto),
    ),
    security(("bearer" = []))
)]
pub async fn create_invitation(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateInvitationDto>,
) -> Result<(StatusCode, Json<OrganizationInvitationDto>)> {
    org_ctx.require_owner()?;

    let invitation = services::organization_invitation::create(
        &state.infra.pool,
        org_ctx.organization.id,
        &body.email,
        &org_ctx.auth.email,
        body.role,
        body.assigned_role_ids.as_deref(),
        body.expires_at,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(services::organization_invitation::to_response(&state.infra.pool, &invitation).await?),
    ))
}

#[utoipa::path(
    put,
    path = "/organizations/{organization_id}/invitations/{invitation_id}",
    tag = "organizations",
    operation_id = "updateOrganizationInvitation",
    summary = "Update invitation",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
        ("invitation_id" = Uuid, Path, description = "ID of the invitation"),
    ),
    request_body = UpdateInvitationDto,
    responses(
        (status = 200, description = "Invitation updated successfully.", body = OrganizationInvitationDto),
    ),
    security(("bearer" = []))
)]
pub async fn update_invitation(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path(params): Path<(Uuid, Uuid)>,
    ValidatedJson(body): ValidatedJson<UpdateInvitationDto>,
) -> Result<Json<OrganizationInvitationDto>> {
    org_ctx.require_owner()?;
    let (_, invitation_id) = params;

    let invitation = services::organization_invitation::update(
        &state.infra.pool,
        invitation_id,
        body.role,
        body.assigned_role_ids.as_deref(),
        body.expires_at,
    )
    .await?;

    Ok(Json(
        services::organization_invitation::to_response(&state.infra.pool, &invitation).await?,
    ))
}

#[utoipa::path(
    post,
    path = "/organizations/{organization_id}/invitations/{invitation_id}/cancel",
    tag = "organizations",
    operation_id = "cancelOrganizationInvitation",
    summary = "Cancel invitation",
    params(
        ("organization_id" = Uuid, Path, description = "ID of the organization"),
        ("invitation_id" = Uuid, Path, description = "ID of the invitation"),
    ),
    responses(
        (status = 204, description = "Invitation cancelled successfully."),
    ),
    security(("bearer" = []))
)]
pub async fn cancel_invitation(
    org_ctx: OrganizationContext,
    State(state): State<AppState>,
    Path(params): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    org_ctx.require_owner()?;
    let (_, invitation_id) = params;
    services::organization_invitation::cancel(&state.infra.pool, invitation_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
