// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use serde::Deserialize;
use uuid::Uuid;

use crate::constants::permissions;
use crate::extractors::organization::{OrgResourceAccess, OrganizationResourceContext};
use crate::extractors::validated_json::ValidatedJson;
use crate::schemas::sandbox::{BucketDto, CreateBucketDto};
use crate::services;
use crate::state::AppState;
use snapflow_errors::{AppError, Result};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListBucketsQuery {
    #[serde(default)]
    pub include_deleted: bool,
}

#[utoipa::path(
    get,
    path = "/buckets",
    tag = "buckets",
    operation_id = "listBuckets",
    summary = "List all buckets",
    params(
        ("includeDeleted" = Option<bool>, Query, description = "Include deleted buckets in the response"),
    ),
    responses(
        (status = 200, description = "List of all buckets.", body = Vec<BucketDto>),
    ),
    security(("bearer" = []))
)]
pub async fn list(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    Query(query): Query<ListBucketsQuery>,
) -> Result<Json<Vec<BucketDto>>> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::READ_BUCKETS])
        .await?;

    let buckets = services::bucket::find_all(
        &state.infra.pool,
        org_ctx.organization.id,
        query.include_deleted,
    )
    .await?;

    Ok(Json(buckets.iter().map(BucketDto::from).collect()))
}

#[utoipa::path(
    post,
    path = "/buckets",
    tag = "buckets",
    operation_id = "createBucket",
    summary = "Create a new bucket",
    request_body = CreateBucketDto,
    responses(
        (status = 200, description = "The bucket has been successfully created.", body = BucketDto),
    ),
    security(("bearer" = []))
)]
pub async fn create(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    ValidatedJson(body): ValidatedJson<CreateBucketDto>,
) -> Result<Json<BucketDto>> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::WRITE_BUCKETS])
        .await?;

    let org_id = org_ctx.organization.id;
    let quota = org_ctx.organization.bucket_quota;

    {
        let key = format!("bucket-concurrent-create-{org_id}");
        let mut conn = state.infra.redis.clone();

        let current: i64 = redis::cmd("GET")
            .arg(&key)
            .query_async::<Option<String>>(&mut conn)
            .await
            .ok()
            .flatten()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);

        let new_count = current + 1;
        let _: std::result::Result<(), _> = redis::cmd("SETEX")
            .arg(&key)
            .arg(1)
            .arg(new_count)
            .query_async(&mut conn)
            .await;

        let active = services::bucket::count_active(&state.infra.pool, org_id).await?;

        if active + new_count > i64::from(quota) {
            return Err(AppError::Forbidden(format!(
                "bucket quota exceeded. Maximum allowed: {quota}"
            )));
        }
    }

    let bucket = services::bucket::create(
        &state.infra.pool,
        org_id,
        Some(org_ctx.auth.user_id),
        quota,
        body.name.as_deref(),
        &state.infra.realtime,
    )
    .await?;

    Ok(Json(BucketDto::from(&bucket)))
}

#[utoipa::path(
    get,
    path = "/buckets/{bucketId}",
    tag = "buckets",
    operation_id = "getBucket",
    summary = "Get bucket details",
    params(
        ("bucketId" = Uuid, Path, description = "ID of the bucket"),
    ),
    responses(
        (status = 200, description = "Bucket details.", body = BucketDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_by_id(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    Path(bucket_id): Path<Uuid>,
) -> Result<Json<BucketDto>> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::READ_BUCKETS])
        .await?;

    let bucket = services::bucket::find_one(&state.infra.pool, bucket_id).await?;

    Ok(Json(BucketDto::from(&bucket)))
}

#[utoipa::path(
    delete,
    path = "/buckets/{bucketId}",
    tag = "buckets",
    operation_id = "deleteBucket",
    summary = "Delete bucket",
    params(
        ("bucketId" = Uuid, Path, description = "ID of the bucket"),
    ),
    responses(
        (status = 200, description = "Bucket has been marked for deletion."),
    ),
    security(("bearer" = []))
)]
pub async fn delete(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    Path(bucket_id): Path<Uuid>,
) -> Result<StatusCode> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::DELETE_BUCKETS])
        .await?;

    services::bucket::delete(&state.infra.pool, bucket_id, &state.infra.realtime).await?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/buckets/by-name/{name}",
    tag = "buckets",
    operation_id = "getBucketByName",
    summary = "Get bucket details by name",
    params(
        ("name" = String, Path, description = "Name of the bucket"),
    ),
    responses(
        (status = 200, description = "Bucket details.", body = BucketDto),
    ),
    security(("bearer" = []))
)]
pub async fn get_by_name(
    org_ctx: OrganizationResourceContext,
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<BucketDto>> {
    org_ctx
        .require_permissions(&state.infra.pool, &[permissions::READ_BUCKETS])
        .await?;

    let bucket =
        services::bucket::find_by_name(&state.infra.pool, org_ctx.organization.id, &name).await?;

    Ok(Json(BucketDto::from(&bucket)))
}
