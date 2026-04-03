// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use axum::extract::State;
use serde::Serialize;
use utoipa::ToSchema;

use crate::state::AppState;
use snapflow_errors::Result;

#[derive(Serialize, ToSchema)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub database: String,
    pub redis: String,
}

#[utoipa::path(
    get,
    path = "/health",
    tag = "health",
    operation_id = "healthCheck",
    summary = "Health check",
    responses(
        (status = 200, description = "Service is healthy.", body = HealthResponse),
    )
)]
pub async fn health(State(state): State<AppState>) -> Result<Json<HealthResponse>> {
    let db_status = match sqlx::query("SELECT 1").execute(&state.infra.pool).await {
        Ok(_) => "ok".to_owned(),
        Err(e) => format!("error: {e}"),
    };

    let redis_status = {
        let result: std::result::Result<String, _> = redis::cmd("PING")
            .query_async(&mut state.infra.redis.clone())
            .await;
        match result {
            Ok(_) => "ok".to_owned(),
            Err(e) => format!("error: {e}"),
        }
    };

    let overall = if db_status == "ok" && (redis_status == "ok" || redis_status == "not configured")
    {
        "ok"
    } else {
        "degraded"
    };

    Ok(Json(HealthResponse {
        status: overall.into(),
        version: env!("CARGO_PKG_VERSION").into(),
        database: db_status,
        redis: redis_status,
    }))
}
