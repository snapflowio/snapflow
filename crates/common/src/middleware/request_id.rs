// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::http::Request;
use axum::http::header::HeaderValue;
use axum::middleware::Next;
use axum::response::Response;
use uuid::Uuid;

use crate::constants::headers;

const DEFAULT_HEADER: &str = headers::REQUEST_ID;

#[derive(Clone, Debug)]
pub struct RequestId(pub String);

pub async fn request_id(request: Request<axum::body::Body>, next: Next) -> Response {
    request_id_with_header(DEFAULT_HEADER, request, next).await
}

pub async fn request_id_with_header(
    header_name: &'static str,
    mut request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let id = request
        .headers()
        .get(header_name)
        .and_then(|v| v.to_str().ok())
        .map(String::from)
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let header_value = HeaderValue::from_str(&id).unwrap_or_else(|_| {
        HeaderValue::from_str(&Uuid::new_v4().to_string())
            .expect("UUID is always a valid header value")
    });

    request.extensions_mut().insert(RequestId(id.clone()));

    let mut response = next.run(request).await;
    response.headers_mut().insert(header_name, header_value);
    response
}
