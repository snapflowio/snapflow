// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::{extract::Request, middleware::Next, response::Response};
use tracing::error;

pub async fn error_middleware(request: Request, next: Next) -> Response {
    let method = request.method().to_string();
    let path = request.uri().path().to_string();

    let response = next.run(request).await;

    let status = response.status();
    if status.is_server_error() {
        error!(
            method = %method,
            path = %path,
            status = status.as_u16(),
            "Internal server error"
        );
    }

    response
}
