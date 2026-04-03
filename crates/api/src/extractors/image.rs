// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::{FromRequestParts, Path};
use axum::http::request::Parts;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Image;
use crate::repositories;
use crate::state::AppState;
use snapflow_errors::AppError;
use snapflow_models::SystemRole;

use super::organization::OrganizationResourceContext;

pub struct ImageAccess {
    pub org_ctx: OrganizationResourceContext,
    pub image: Image,
}

async fn find_by_name_or_general(
    pool: &PgPool,
    name: &str,
    org_id: Uuid,
) -> Result<Image, AppError> {
    repositories::image::find_by_name(pool, name, org_id)
        .await?
        .or(repositories::image::find_general_by_name(pool, name).await?)
        .ok_or(AppError::NotFound(format!("image {name} not found")))
}

impl FromRequestParts<AppState> for ImageAccess {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let org_ctx = OrganizationResourceContext::from_request_parts(parts, state).await?;

        let image_id_or_name =
            Path::<std::collections::HashMap<String, String>>::from_request_parts(parts, state)
                .await
                .ok()
                .and_then(|p| {
                    p.get("imageId")
                        .or_else(|| p.get("image_id"))
                        .or_else(|| p.get("id"))
                        .cloned()
                })
                .ok_or(AppError::BadRequest("image id is required".into()))?;

        let image = match Uuid::parse_str(&image_id_or_name) {
            Ok(id) => match repositories::image::find_by_id(&state.infra.pool, id).await? {
                Some(img) => img,
                None => {
                    find_by_name_or_general(
                        &state.infra.pool,
                        &image_id_or_name,
                        org_ctx.organization.id,
                    )
                    .await?
                }
            },
            Err(_) => {
                find_by_name_or_general(
                    &state.infra.pool,
                    &image_id_or_name,
                    org_ctx.organization.id,
                )
                .await?
            }
        };

        if org_ctx.auth.role != SystemRole::Admin
            && !image.general
            && image.organization_id != Some(org_ctx.organization.id)
        {
            return Err(AppError::Forbidden(
                "request organization ID does not match resource organization ID".into(),
            ));
        }

        Ok(ImageAccess { org_ctx, image })
    }
}
