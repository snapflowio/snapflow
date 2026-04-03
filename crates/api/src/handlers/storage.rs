// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::State;

use crate::constants::permissions;
use crate::extractors::organization::{OrgResourceAccess, OrganizationResourceContext};
use crate::schemas::storage::StorageAccessDto;
use crate::state::AppState;
use snapflow_errors::Result;

#[utoipa::path(
    get,
    path = "/storage/push-access",
    tag = "storage",
    operation_id = "getPushAccess",
    summary = "Get pre-signed URL for uploading objects to Cloudflare R2",
    description = "Returns a pre-signed URL scoped to the organization's storage path. The URL expires after a short period.",
    responses(
        (status = 200, description = "Pre-signed upload URL has been generated.", body = StorageAccessDto),
        (status = 400, description = "Failed to generate URL"),
        (status = 403, description = "Missing WRITE_BUCKETS permission"),
    ),
    security(("bearer" = []))
)]
pub async fn get_push_access(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
) -> Result<Json<StorageAccessDto>> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_BUCKETS])
        .await?;

    let storage = state.infra.require_storage()?;

    let response = storage.get_push_access(org_ctx.organization.id).await?;

    Ok(Json(response))
}
