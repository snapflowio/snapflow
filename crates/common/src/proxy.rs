// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use axum::{
    body::Body,
    http::{Request, StatusCode, header},
    response::{IntoResponse, Response},
};
use hyper_util::rt::TokioIo;
use rustls::ClientConfig;
use rustls::pki_types::ServerName;
use tokio_rustls::TlsConnector;

fn build_tls_connector() -> TlsConnector {
    let mut root_store = rustls::RootCertStore::empty();

    let certs = rustls_native_certs::load_native_certs();
    if !certs.errors.is_empty() {
        tracing::warn!("errors loading native certs: {:?}", certs.errors);
    }
    for cert in certs.certs {
        let _ = root_store.add(cert);
    }

    let config = ClientConfig::builder()
        .with_root_certificates(root_store)
        .with_no_client_auth();

    TlsConnector::from(Arc::new(config))
}

pub async fn forward(request: Request<Body>, target_addr: &str) -> Response {
    forward_inner(request, target_addr, false, "").await
}

pub async fn forward_tls(request: Request<Body>, target_addr: &str, server_name: &str) -> Response {
    forward_inner(request, target_addr, true, server_name).await
}

async fn forward_inner(
    request: Request<Body>,
    target_addr: &str,
    use_tls: bool,
    server_name: &str,
) -> Response {
    let is_upgrade = request
        .headers()
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.eq_ignore_ascii_case("websocket"));

    let tcp_stream = match tokio::time::timeout(
        std::time::Duration::from_secs(30),
        tokio::net::TcpStream::connect(target_addr),
    )
    .await
    {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            tracing::error!(error = %e, addr = target_addr, "failed to connect to upstream");
            return (StatusCode::BAD_GATEWAY, "upstream connection failed").into_response();
        }
        Err(_) => {
            tracing::error!(addr = target_addr, "upstream connection timed out");
            return (StatusCode::GATEWAY_TIMEOUT, "upstream connection timed out").into_response();
        }
    };

    if use_tls {
        let connector = build_tls_connector();
        let dns_name = match ServerName::try_from(server_name.to_owned()) {
            Ok(n) => n,
            Err(e) => {
                tracing::error!(error = %e, server_name, "invalid TLS server name");
                return (StatusCode::BAD_GATEWAY, "invalid tls server name").into_response();
            }
        };

        let tls_stream = match connector.connect(dns_name, tcp_stream).await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(error = %e, addr = target_addr, "TLS handshake failed");
                return (StatusCode::BAD_GATEWAY, "tls handshake failed").into_response();
            }
        };

        let io = TokioIo::new(tls_stream);
        forward_over_io(request, io, target_addr, is_upgrade).await
    } else {
        let io = TokioIo::new(tcp_stream);
        forward_over_io(request, io, target_addr, is_upgrade).await
    }
}

async fn forward_over_io<I>(
    mut request: Request<Body>,
    io: I,
    _target_addr: &str,
    is_upgrade: bool,
) -> Response
where
    I: hyper::rt::Read + hyper::rt::Write + Send + Unpin + 'static,
{
    let (mut sender, conn) = match hyper::client::conn::http1::handshake(io).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "upstream handshake failed");
            return (StatusCode::BAD_GATEWAY, "upstream handshake failed").into_response();
        }
    };

    tokio::spawn(async move {
        if let Err(e) = conn.with_upgrades().await {
            tracing::debug!(error = %e, "upstream connection closed");
        }
    });

    if is_upgrade {
        let client_upgrade = hyper::upgrade::on(&mut request);

        let mut upstream_resp = match sender.send_request(request).await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "upstream request failed");
                return (StatusCode::BAD_GATEWAY, "upstream request failed").into_response();
            }
        };

        if upstream_resp.status() != StatusCode::SWITCHING_PROTOCOLS {
            let (parts, body) = upstream_resp.into_parts();
            return Response::from_parts(parts, Body::new(body));
        }

        let upstream_upgrade = hyper::upgrade::on(&mut upstream_resp);

        let mut response_builder = Response::builder().status(StatusCode::SWITCHING_PROTOCOLS);
        for (key, value) in upstream_resp.headers() {
            response_builder = response_builder.header(key, value);
        }
        let response = response_builder
            .body(Body::empty())
            .expect("response builder cannot fail after setting status and headers");

        tokio::spawn(async move {
            let (client_io, upstream_io) = match tokio::try_join!(client_upgrade, upstream_upgrade)
            {
                Ok(v) => v,
                Err(e) => {
                    tracing::error!(error = %e, "upgrade failed");
                    return;
                }
            };

            let mut client_io = TokioIo::new(client_io);
            let mut upstream_io = TokioIo::new(upstream_io);

            let _ = tokio::io::copy_bidirectional(&mut client_io, &mut upstream_io).await;
        });

        response
    } else {
        match sender.send_request(request).await {
            Ok(resp) => {
                let (parts, body) = resp.into_parts();
                Response::from_parts(parts, Body::new(body))
            }
            Err(e) => {
                tracing::error!(error = %e, "upstream request failed");
                (StatusCode::BAD_GATEWAY, "upstream request failed").into_response()
            }
        }
    }
}
