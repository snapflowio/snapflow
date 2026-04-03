// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Router;
use axum::routing::get;
use utoipa::OpenApi;

use crate::handlers;
use crate::schemas;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::bucket::list,
        handlers::bucket::create,
        handlers::bucket::get_by_id,
        handlers::bucket::delete,
        handlers::bucket::get_by_name,
    ),
    components(schemas(schemas::sandbox::BucketDto, schemas::sandbox::CreateBucketDto,))
)]
pub struct Api;

pub fn router() -> Router<AppState> {
    Router::default()
        .route(
            "/buckets/by-name/{name}",
            get(handlers::bucket::get_by_name),
        )
        .route(
            "/buckets",
            get(handlers::bucket::list).post(handlers::bucket::create),
        )
        .route(
            "/buckets/{bucketId}",
            get(handlers::bucket::get_by_id).delete(handlers::bucket::delete),
        )
}
