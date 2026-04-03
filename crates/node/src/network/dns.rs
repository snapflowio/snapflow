// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::{Context, Result};
use chrono::Utc;
use hickory_proto::op::{Message, ResponseCode};
use hickory_proto::rr::RData;
use hickory_proto::serialize::binary::BinDecodable;
use tokio::net::UdpSocket;
use tokio::sync::Semaphore;

use super::store::NetworkEventBroadcast;
use super::types::{DnsEvent, NetworkEvent};

const DNS_PORT: u16 = 53;
const MAX_DNS_PACKET: usize = 4096;
const MAX_CONCURRENT_QUERIES: usize = 256;

pub async fn run_dns_proxy(
    upstream: SocketAddr,
    broadcaster: Arc<NetworkEventBroadcast>,
) -> Result<()> {
    let socket = Arc::new(
        UdpSocket::bind(("0.0.0.0", DNS_PORT))
            .await
            .context("failed to bind DNS proxy socket")?,
    );

    tracing::info!(port = DNS_PORT, upstream = %upstream, "DNS proxy started");

    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_QUERIES));
    let mut buf = vec![0u8; MAX_DNS_PACKET];

    loop {
        let (len, client_addr) = match socket.recv_from(&mut buf).await {
            Ok(result) => result,
            Err(e) => {
                tracing::warn!(error = %e, "DNS recv error");
                continue;
            }
        };

        let permit = match semaphore.clone().try_acquire_owned() {
            Ok(permit) => permit,
            Err(_) => {
                tracing::debug!("DNS query dropped, too many concurrent queries");
                continue;
            }
        };

        let query_data = buf[..len].to_vec();
        let broadcaster = Arc::clone(&broadcaster);
        let reply_socket = Arc::clone(&socket);

        tokio::spawn(async move {
            let _permit = permit;
            match handle_dns_query(&query_data, upstream).await {
                Ok((response_data, event)) => {
                    broadcaster.send(NetworkEvent::Dns(event));
                    if let Err(e) = reply_socket.send_to(&response_data, client_addr).await {
                        tracing::warn!(error = %e, "failed to send DNS response");
                    }
                }
                Err(e) => {
                    tracing::debug!(error = %e, "DNS query handling failed");
                }
            }
        });
    }
}

async fn handle_dns_query(query_data: &[u8], upstream: SocketAddr) -> Result<(Vec<u8>, DnsEvent)> {
    let query = Message::from_bytes(query_data).context("failed to parse DNS query")?;

    let domain = query
        .queries()
        .first()
        .map(|q| q.name().to_string().trim_end_matches('.').to_owned())
        .unwrap_or_default();

    let query_type = query
        .queries()
        .first()
        .map(|q| q.query_type().to_string())
        .unwrap_or_default();

    let forward_socket = UdpSocket::bind("0.0.0.0:0")
        .await
        .context("failed to bind forward socket")?;

    forward_socket
        .send_to(query_data, upstream)
        .await
        .context("failed to forward DNS query")?;

    let mut response_buf = vec![0u8; MAX_DNS_PACKET];
    let (len, _) = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        forward_socket.recv_from(&mut response_buf),
    )
    .await
    .context("DNS upstream timeout")?
    .context("DNS upstream recv error")?;

    let response_data = response_buf[..len].to_vec();
    let resolved_ips = extract_ips_from_response(&response_data);

    let event = DnsEvent {
        domain,
        query_type,
        resolved_ips,
        timestamp: Utc::now().to_rfc3339(),
    };

    Ok((response_data, event))
}

fn extract_ips_from_response(data: &[u8]) -> Vec<String> {
    let Ok(response) = Message::from_bytes(data) else {
        return vec![];
    };

    if response.response_code() != ResponseCode::NoError {
        return vec![];
    }

    response
        .answers()
        .iter()
        .filter_map(|record| match record.data() {
            RData::A(a) => Some(a.0.to_string()),
            RData::AAAA(aaaa) => Some(aaaa.0.to_string()),
            _ => None,
        })
        .collect()
}
