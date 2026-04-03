// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use anyhow::Result;
use chrono::Utc;
use http_body_util::{BodyExt, Full, Limited};
use hudsucker::certificate_authority::RcgenAuthority;
use hudsucker::hyper::body::Bytes;
use hudsucker::hyper::{Request, Response};
use hudsucker::rustls::crypto::aws_lc_rs;
use hudsucker::{Body, HttpContext, HttpHandler, Proxy, RequestOrResponse, decode_response};

use super::store::NetworkEventBroadcast;
use super::types::{HttpEvent, NetworkEvent, truncate_body};

const PROXY_PORT: u16 = 8080;
const MAX_BODY_COLLECT: u64 = 10 * 1024 * 1024;

#[derive(Clone)]
struct InterceptHandler {
    broadcaster: Arc<NetworkEventBroadcast>,
    start: Option<Instant>,
    method: String,
    url: String,
    host: String,
    port: u16,
    tls: bool,
    req_headers: HashMap<String, String>,
    req_body: Option<String>,
}

impl InterceptHandler {
    fn new(broadcaster: Arc<NetworkEventBroadcast>) -> Self {
        Self {
            broadcaster,
            start: None,
            method: String::default(),
            url: String::default(),
            host: String::default(),
            port: 0,
            tls: false,
            req_headers: HashMap::default(),
            req_body: None,
        }
    }

    fn rebuild_body(bytes: Bytes) -> Body {
        Body::from(Full::new(bytes))
    }

    fn emit(
        &mut self,
        status_code: Option<u16>,
        response_headers: Option<HashMap<String, String>>,
        response_body: Option<String>,
    ) {
        let duration_ms = self
            .start
            .map(|s| s.elapsed().as_millis() as u64)
            .unwrap_or(0);

        self.broadcaster.send(NetworkEvent::Http(HttpEvent {
            method: std::mem::take(&mut self.method),
            url: std::mem::take(&mut self.url),
            host: std::mem::take(&mut self.host),
            port: self.port,
            tls: self.tls,
            request_headers: std::mem::take(&mut self.req_headers),
            request_body: self.req_body.take(),
            status_code,
            response_headers,
            response_body,
            duration_ms,
            timestamp: Utc::now().to_rfc3339(),
        }));
    }
}

impl HttpHandler for InterceptHandler {
    async fn handle_request(
        &mut self,
        _ctx: &HttpContext,
        req: Request<Body>,
    ) -> RequestOrResponse {
        self.start = Some(Instant::now());
        self.method = req.method().to_string();
        self.url = req.uri().to_string();
        self.tls = req.uri().scheme_str() == Some("https") || self.port == 443;

        self.host = req
            .uri()
            .host()
            .or_else(|| {
                req.headers()
                    .get("host")
                    .and_then(|h| h.to_str().ok())
                    .map(|h| h.split(':').next().unwrap_or(h))
            })
            .unwrap_or("unknown")
            .to_owned();

        self.port = req
            .uri()
            .port_u16()
            .unwrap_or(if self.tls { 443 } else { 80 });

        self.req_headers = collect_headers(req.headers());

        let (parts, body) = req.into_parts();
        let limited = Limited::new(body, MAX_BODY_COLLECT as usize);
        match limited.collect().await {
            Ok(collected) => {
                let bytes = collected.to_bytes();
                let ct = self.req_headers.get("content-type").map(|s| s.as_str());
                self.req_body = truncate_body(&bytes, ct);
                Request::from_parts(parts, Self::rebuild_body(bytes)).into()
            }
            Err(_) => {
                self.req_body = Some(format!(
                    "[body exceeded {}MB limit]",
                    MAX_BODY_COLLECT / 1024 / 1024
                ));
                Request::from_parts(parts, Body::empty()).into()
            }
        }
    }

    async fn handle_response(&mut self, _ctx: &HttpContext, res: Response<Body>) -> Response<Body> {
        let res = match decode_response(res) {
            Ok(r) => r,
            Err(e) => {
                tracing::debug!(error = %e, "decode_response failed");
                self.emit(Some(502), None, None);
                return Response::builder()
                    .status(502)
                    .body(Body::empty())
                    .expect("static 502 response");
            }
        };

        let status = res.status().as_u16();
        let resp_headers = collect_headers(res.headers());

        let (parts, body) = res.into_parts();
        let limited = Limited::new(body, MAX_BODY_COLLECT as usize);
        match limited.collect().await {
            Ok(collected) => {
                let bytes = collected.to_bytes();
                let ct = resp_headers.get("content-type").map(|s| s.as_str());
                let resp_body = truncate_body(&bytes, ct);
                self.emit(Some(status), Some(resp_headers), resp_body);
                Response::from_parts(parts, Self::rebuild_body(bytes))
            }
            Err(_) => {
                self.emit(
                    Some(status),
                    Some(resp_headers),
                    Some(format!(
                        "[body exceeded {}MB limit]",
                        MAX_BODY_COLLECT / 1024 / 1024
                    )),
                );
                Response::from_parts(parts, Body::empty())
            }
        }
    }

    async fn should_intercept(&mut self, _ctx: &HttpContext, _req: &Request<Body>) -> bool {
        true
    }
}

pub async fn run_http_proxy(
    broadcaster: Arc<NetworkEventBroadcast>,
    ca: RcgenAuthority,
) -> Result<()> {
    tracing::info!(port = PROXY_PORT, "HTTP/HTTPS MITM proxy started");

    let proxy = Proxy::builder()
        .with_addr(SocketAddr::from(([127, 0, 0, 1], PROXY_PORT)))
        .with_ca(ca)
        .with_rustls_connector(aws_lc_rs::default_provider())
        .with_http_handler(InterceptHandler::new(broadcaster))
        .build()
        .map_err(|e| anyhow::anyhow!("failed to build proxy: {e}"))?;

    proxy
        .start()
        .await
        .map_err(|e| anyhow::anyhow!("proxy error: {e}"))
}

fn collect_headers(headers: &hudsucker::hyper::HeaderMap) -> HashMap<String, String> {
    headers
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_owned()))
        .collect()
}
