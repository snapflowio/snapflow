// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;

use base64::Engine;
use serde::Serialize;
use utoipa::ToSchema;

const MAX_BODY_CAPTURE_SIZE: usize = 64 * 1024;

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NetworkEvent {
    Dns(DnsEvent),
    Http(HttpEvent),
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DnsEvent {
    pub domain: String,
    pub query_type: String,
    pub resolved_ips: Vec<String>,
    pub timestamp: String,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct HttpEvent {
    pub method: String,
    pub url: String,
    pub host: String,
    pub port: u16,
    pub tls: bool,
    pub request_headers: HashMap<String, String>,
    pub request_body: Option<String>,
    pub status_code: Option<u16>,
    pub response_headers: Option<HashMap<String, String>>,
    pub response_body: Option<String>,
    pub duration_ms: u64,
    pub timestamp: String,
}

pub fn truncate_body(body: &[u8], content_type: Option<&str>) -> Option<String> {
    if body.is_empty() {
        return None;
    }

    let is_binary = content_type
        .map(|ct| {
            ct.starts_with("image/")
                || ct.starts_with("audio/")
                || ct.starts_with("video/")
                || ct.contains("octet-stream")
        })
        .unwrap_or(false);

    let slice = if body.len() > MAX_BODY_CAPTURE_SIZE {
        &body[..MAX_BODY_CAPTURE_SIZE]
    } else {
        body
    };

    if is_binary {
        Some(base64::engine::general_purpose::STANDARD.encode(slice))
    } else {
        Some(String::from_utf8_lossy(slice).into_owned())
    }
}
