// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::State;
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;

use crate::state::AppState;
use snapflow_errors::{AppError, Result};

pub async fn maintenance(
    State(state): State<AppState>,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response> {
    if state.infra.config.maintenance_mode {
        return Err(AppError::ServiceUnavailable(
            "service is currently under maintenance, please try again later".into(),
        ));
    }
    Ok(next.run(request).await)
}
