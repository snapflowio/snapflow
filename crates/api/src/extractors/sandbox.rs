// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::{FromRequestParts, Path};
use axum::http::request::Parts;
use uuid::Uuid;

use crate::models::Sandbox;
use crate::repositories;
use crate::state::AppState;
use snapflow_errors::AppError;
use snapflow_models::SystemRole;

use super::organization::OrganizationResourceContext;

pub struct SandboxAccess {
    pub org_ctx: OrganizationResourceContext,
    pub sandbox: Sandbox,
}

impl FromRequestParts<AppState> for SandboxAccess {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let org_ctx = OrganizationResourceContext::from_request_parts(parts, state).await?;

        let sandbox_id =
            Path::<std::collections::HashMap<String, String>>::from_request_parts(parts, state)
                .await
                .ok()
                .and_then(|p| {
                    p.get("sandboxId")
                        .or_else(|| p.get("id"))
                        .and_then(|v| Uuid::parse_str(v).ok())
                })
                .ok_or(AppError::BadRequest("sandbox id is required".into()))?;

        let sandbox = repositories::sandbox::find_by_id(&state.infra.pool, sandbox_id)
            .await?
            .ok_or(AppError::NotFound(format!(
                "sandbox {sandbox_id} not found"
            )))?;

        if org_ctx.auth.role != SystemRole::Admin
            && sandbox.organization_id != org_ctx.organization.id
        {
            return Err(AppError::Forbidden(
                "request organization ID does not match resource organization ID".into(),
            ));
        }

        Ok(SandboxAccess { org_ctx, sandbox })
    }
}
