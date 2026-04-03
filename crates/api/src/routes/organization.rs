// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Router;
use axum::routing::{delete, get, patch, post, put};
use utoipa::OpenApi;

use crate::handlers;
use crate::schemas;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::organization::create,
        handlers::organization::list,
        handlers::organization::get,
        handlers::organization::delete,
        handlers::organization::usage,
        handlers::organization::update_quota,
        handlers::organization::leave,
        handlers::organization::suspend,
        handlers::organization::unsuspend,
        handlers::organization::list_users,
        handlers::organization::update_user_role,
        handlers::organization::update_assigned_roles,
        handlers::organization::remove_user,
        handlers::organization::list_roles,
        handlers::organization::create_role,
        handlers::organization::update_role,
        handlers::organization::delete_role,
        handlers::organization::list_user_invitations,
        handlers::organization::count_user_invitations,
        handlers::organization::accept_invitation,
        handlers::organization::decline_invitation,
        handlers::organization::list_org_invitations,
        handlers::organization::create_invitation,
        handlers::organization::update_invitation,
        handlers::organization::cancel_invitation,
    ),
    components(schemas(
        schemas::organization::CreateOrganizationDto,
        schemas::organization::OrganizationDto,
        schemas::organization::UpdateQuotaDto,
        schemas::organization::SuspendDto,
        schemas::organization::UsageOverviewDto,
        schemas::organization::OrganizationUserDto,
        schemas::organization::UpdateMemberRoleDto,
        schemas::organization::UpdateAssignedRolesDto,
        schemas::organization::OrganizationRoleDto,
        schemas::organization::CreateOrganizationRoleDto,
        schemas::organization::UpdateOrganizationRoleDto,
        schemas::organization::OrganizationInvitationDto,
        schemas::organization::CreateInvitationDto,
        schemas::organization::UpdateInvitationDto,
        snapflow_models::OrganizationMemberRole,
        snapflow_models::OrganizationInvitationStatus,
        snapflow_models::OrganizationResourcePermission,
    ))
)]
pub struct Api;

pub fn router() -> Router<AppState> {
    Router::default()
        .route(
            "/organizations/invitations",
            get(handlers::organization::list_user_invitations),
        )
        .route(
            "/organizations/invitations/count",
            get(handlers::organization::count_user_invitations),
        )
        .route(
            "/organizations/invitations/{invitation_id}/accept",
            post(handlers::organization::accept_invitation),
        )
        .route(
            "/organizations/invitations/{invitation_id}/decline",
            post(handlers::organization::decline_invitation),
        )
        .route(
            "/organizations",
            post(handlers::organization::create).get(handlers::organization::list),
        )
        .route(
            "/organizations/{organization_id}",
            get(handlers::organization::get).delete(handlers::organization::delete),
        )
        .route(
            "/organizations/{organization_id}/usage",
            get(handlers::organization::usage),
        )
        .route(
            "/organizations/{organization_id}/quota",
            patch(handlers::organization::update_quota),
        )
        .route(
            "/organizations/{organization_id}/leave",
            post(handlers::organization::leave),
        )
        .route(
            "/organizations/{organization_id}/suspend",
            post(handlers::organization::suspend),
        )
        .route(
            "/organizations/{organization_id}/unsuspend",
            post(handlers::organization::unsuspend),
        )
        .route(
            "/organizations/{organization_id}/users",
            get(handlers::organization::list_users),
        )
        .route(
            "/organizations/{organization_id}/users/{user_id}/role",
            post(handlers::organization::update_user_role),
        )
        .route(
            "/organizations/{organization_id}/users/{user_id}/assigned-roles",
            post(handlers::organization::update_assigned_roles),
        )
        .route(
            "/organizations/{organization_id}/users/{user_id}",
            delete(handlers::organization::remove_user),
        )
        .route(
            "/organizations/{organization_id}/roles",
            get(handlers::organization::list_roles).post(handlers::organization::create_role),
        )
        .route(
            "/organizations/{organization_id}/roles/{role_id}",
            put(handlers::organization::update_role).delete(handlers::organization::delete_role),
        )
        .route(
            "/organizations/{organization_id}/invitations",
            get(handlers::organization::list_org_invitations)
                .post(handlers::organization::create_invitation),
        )
        .route(
            "/organizations/{organization_id}/invitations/{invitation_id}",
            put(handlers::organization::update_invitation),
        )
        .route(
            "/organizations/{organization_id}/invitations/{invitation_id}/cancel",
            post(handlers::organization::cancel_invitation),
        )
}
