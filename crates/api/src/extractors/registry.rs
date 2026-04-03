// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::{FromRequestParts, Path};
use axum::http::request::Parts;
use uuid::Uuid;

use crate::models::Registry;
use crate::repositories;
use crate::state::AppState;
use snapflow_errors::AppError;
use snapflow_models::SystemRole;

use super::organization::OrganizationResourceContext;

pub struct RegistryAccess {
    pub org_ctx: OrganizationResourceContext,
    pub registry: Registry,
}

impl FromRequestParts<AppState> for RegistryAccess {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let org_ctx = OrganizationResourceContext::from_request_parts(parts, state).await?;

        let registry_id =
            Path::<std::collections::HashMap<String, String>>::from_request_parts(parts, state)
                .await
                .ok()
                .and_then(|p| {
                    p.get("id")
                        .or_else(|| p.get("registry_id"))
                        .and_then(|v| Uuid::parse_str(v).ok())
                })
                .ok_or(AppError::BadRequest("registry id is required".into()))?;

        let registry = repositories::registry::find_by_id(&state.infra.pool, registry_id)
            .await?
            .ok_or(AppError::NotFound("registry not found".into()))?;

        if org_ctx.auth.role != SystemRole::Admin
            && registry.organization_id != Some(org_ctx.organization.id)
        {
            return Err(AppError::Forbidden(
                "registry does not belong to this organization".into(),
            ));
        }

        Ok(RegistryAccess { org_ctx, registry })
    }
}
