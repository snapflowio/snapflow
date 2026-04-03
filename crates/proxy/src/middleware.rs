// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::{extract::Request, http::header, middleware::Next, response::Response};

pub async fn cors_middleware(req: Request, next: Next) -> Response {
    let should_skip = req
        .headers()
        .get("X-Snapflow-Disable-CORS")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v == "true");

    if should_skip {
        let mut req = req;
        req.headers_mut().remove("X-Snapflow-Disable-CORS");
        req.headers_mut().remove(header::ORIGIN);
        return next.run(req).await;
    }

    next.run(req).await
}
