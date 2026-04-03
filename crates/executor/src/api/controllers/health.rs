// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::Json;
use serde_json::{Value, json};

#[utoipa::path(
    get,
    path = "/",
    summary = "Health check",
    description = "Health check",
    operation_id = "HealthCheck",
    responses(
        (status = 200, description = "OK", body = Object)
    )
)]
pub async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
