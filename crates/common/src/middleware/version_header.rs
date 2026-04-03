// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::extract::Request;
use axum::http::header::HeaderValue;
use axum::middleware::Next;
use axum::response::Response;

#[derive(Clone)]
pub struct VersionHeader {
    header_name: &'static str,
    header_value: HeaderValue,
}

impl VersionHeader {
    pub fn new(header_name: &'static str, version: &'static str) -> Self {
        Self {
            header_name,
            header_value: HeaderValue::from_str(version)
                .expect("version string is a valid header value"),
        }
    }

    pub async fn handle(self, request: Request, next: Next) -> Response {
        let mut response = next.run(request).await;
        response
            .headers_mut()
            .insert(self.header_name, self.header_value);
        response
    }
}
