// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use axum::{
    body::Body,
    http::{Request, StatusCode, header},
    response::{IntoResponse, Response},
};
use hyper_util::rt::TokioIo;

pub async fn forward(mut request: Request<Body>, target_addr: &str) -> Response {
    let is_upgrade = request
        .headers()
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.eq_ignore_ascii_case("websocket"));

    let stream = match tokio::time::timeout(
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

    let io = TokioIo::new(stream);

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
