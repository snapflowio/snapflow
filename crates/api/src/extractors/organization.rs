// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashSet;

use axum::extract::{FromRequestParts, Path};
use axum::http::request::Parts;
use uuid::Uuid;

use crate::models::{Organization, OrganizationUser};
use crate::repositories;
use crate::state::AppState;
use snapflow_errors::AppError;
use snapflow_models::{OrganizationMemberRole, SystemRole};

use super::auth::{AuthContext, AuthMethod};

pub trait OrgAccess {
    fn auth(&self) -> &AuthContext;
    fn organization(&self) -> &Organization;
    fn membership(&self) -> Option<&OrganizationUser>;

    fn require_owner(&self) -> Result<(), AppError> {
        if self.auth().role == SystemRole::Admin {
            return Ok(());
        }
        match self.membership() {
            Some(m) if m.role == OrganizationMemberRole::Owner => Ok(()),
            _ => Err(AppError::Forbidden("owner access required".into())),
        }
    }

    fn require_admin(&self) -> Result<(), AppError> {
        if self.auth().role == SystemRole::Admin {
            return Ok(());
        }
        Err(AppError::Forbidden("admin access required".into()))
    }
}

pub trait OrgResourceAccess: OrgAccess + Sync {
    fn require_permissions(
        &self,
        pool: &sqlx::PgPool,
        required: &[&str],
    ) -> impl std::future::Future<Output = Result<(), AppError>> + Send {
        async move {
            if self.auth().role == SystemRole::Admin {
                return Ok(());
            }

            if let Some(m) = self.membership()
                && m.role == OrganizationMemberRole::Owner
                && self.auth().api_key.is_none()
            {
                return Ok(());
            }

            let user_perms: HashSet<String> = if let Some(ref api_key) = self.auth().api_key {
                api_key.permissions.iter().cloned().collect()
            } else {
                let perms = repositories::organization_user::find_user_permissions(
                    pool,
                    self.organization().id,
                    self.auth().user_id,
                )
                .await
                .map_err(AppError::Sqlx)?;

                perms.into_iter().collect()
            };

            for perm in required {
                if !user_perms.contains(*perm) {
                    return Err(AppError::Forbidden(format!(
                        "missing required permission: {perm}"
                    )));
                }
            }

            Ok(())
        }
    }
}

struct ResolvedOrg {
    auth: AuthContext,
    organization: Organization,
    membership: Option<OrganizationUser>,
}

async fn resolve_org(parts: &mut Parts, state: &AppState) -> Result<ResolvedOrg, AppError> {
    let auth = parts
        .extensions
        .get::<AuthContext>()
        .cloned()
        .ok_or(AppError::Unauthorized("authentication required".into()))?;

    let org_id =
        Path::<std::collections::HashMap<String, String>>::from_request_parts(parts, state)
            .await
            .ok()
            .and_then(|p| {
                p.get("organization_id")
                    .and_then(|v| Uuid::parse_str(v).ok())
            })
            .or(auth.organization_id)
            .ok_or(AppError::BadRequest("organization_id is required".into()))?;

    let organization = repositories::organization::find_by_id(&state.infra.pool, org_id)
        .await?
        .ok_or(AppError::NotFound("organization not found".into()))?;

    if let Some(ref api_key) = auth.api_key
        && api_key.organization_id != org_id
    {
        return Err(AppError::Forbidden(
            "API key does not belong to this organization".into(),
        ));
    }

    let membership = if auth.role == SystemRole::Admin {
        None
    } else {
        let member =
            repositories::organization_user::find_one(&state.infra.pool, org_id, auth.user_id)
                .await?;

        if member.is_none() && auth.role != SystemRole::Proxy {
            return Err(AppError::Forbidden(
                "you are not a member of this organization".into(),
            ));
        }

        member
    };

    Ok(ResolvedOrg {
        auth,
        organization,
        membership,
    })
}

pub struct OrganizationContext {
    pub auth: AuthContext,
    pub organization: Organization,
    pub membership: Option<OrganizationUser>,
}

impl OrgAccess for OrganizationContext {
    fn auth(&self) -> &AuthContext {
        &self.auth
    }
    fn organization(&self) -> &Organization {
        &self.organization
    }
    fn membership(&self) -> Option<&OrganizationUser> {
        self.membership.as_ref()
    }
}

impl FromRequestParts<AppState> for OrganizationContext {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let resolved = resolve_org(parts, state).await?;

        if resolved.auth.method != AuthMethod::Session {
            return Err(AppError::Unauthorized(
                "session authentication required".into(),
            ));
        }

        Ok(OrganizationContext {
            auth: resolved.auth,
            organization: resolved.organization,
            membership: resolved.membership,
        })
    }
}

pub struct OrganizationResourceContext {
    pub auth: AuthContext,
    pub organization: Organization,
    pub membership: Option<OrganizationUser>,
}

impl OrgAccess for OrganizationResourceContext {
    fn auth(&self) -> &AuthContext {
        &self.auth
    }
    fn organization(&self) -> &Organization {
        &self.organization
    }
    fn membership(&self) -> Option<&OrganizationUser> {
        self.membership.as_ref()
    }
}

impl OrgResourceAccess for OrganizationResourceContext {}

impl FromRequestParts<AppState> for OrganizationResourceContext {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let resolved = resolve_org(parts, state).await?;

        if !matches!(
            resolved.auth.method,
            AuthMethod::Session | AuthMethod::ApiKey
        ) {
            return Err(AppError::Unauthorized("session or API key required".into()));
        }

        Ok(OrganizationResourceContext {
            auth: resolved.auth,
            organization: resolved.organization,
            membership: resolved.membership,
        })
    }
}
