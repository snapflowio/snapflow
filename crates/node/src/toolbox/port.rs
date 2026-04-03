// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use crate::common::errors::AppError;
use crate::toolbox::AppState;
use axum::{
    Json,
    extract::{Path, State},
};
use dashmap::DashMap;
use serde::Serialize;
use std::sync::Arc;
use tokio::net::TcpStream;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
pub struct PortList {
    pub ports: Vec<u16>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IsPortInUseResponse {
    pub is_in_use: bool,
}

pub struct PortDetector {
    ports: DashMap<u16, bool>,
}

impl Default for PortDetector {
    fn default() -> Self {
        Self {
            ports: DashMap::default(),
        }
    }
}

impl PortDetector {
    /// Background task that polls /proc/net/tcp every second.
    pub async fn run(&self) {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;

            let mut fresh: std::collections::HashSet<u16> = std::collections::HashSet::default();

            if let Ok(tcp) = procfs::net::tcp() {
                for entry in &tcp {
                    if entry.state == procfs::net::TcpState::Listen {
                        let port = entry.local_address.port();
                        fresh.insert(port);
                        self.ports.insert(port, true);
                    }
                }
            }

            if let Ok(tcp6) = procfs::net::tcp6() {
                for entry in &tcp6 {
                    if entry.state == procfs::net::TcpState::Listen {
                        let port = entry.local_address.port();
                        fresh.insert(port);
                        self.ports.insert(port, true);
                    }
                }
            }

            let stale: Vec<u16> = self
                .ports
                .iter()
                .map(|e| *e.key())
                .filter(|p| !fresh.contains(p))
                .collect();
            for p in stale {
                self.ports.remove(&p);
            }
        }
    }

    pub fn list_ports(&self) -> Vec<u16> {
        self.ports.iter().map(|e| *e.key()).collect()
    }

    pub fn has_port(&self, port: u16) -> bool {
        self.ports.contains_key(&port)
    }

    pub fn mark_in_use(&self, port: u16) {
        self.ports.insert(port, true);
    }
}

#[utoipa::path(
    get,
    path = "/port",
    tag = "port",
    operation_id = "listPorts",
    responses(
        (status = 200, body = PortList),
    )
)]
pub async fn get_ports(State(state): State<Arc<AppState>>) -> Json<PortList> {
    Json(PortList {
        ports: state.port_detector.list_ports(),
    })
}

#[utoipa::path(
    get,
    path = "/port/{port}/in-use",
    tag = "port",
    operation_id = "isPortInUse",
    params(
        ("port" = String, Path,),
    ),
    responses(
        (status = 200, body = IsPortInUseResponse),
    )
)]
pub async fn is_port_in_use(
    State(state): State<Arc<AppState>>,
    Path(port): Path<String>,
) -> Result<Json<IsPortInUseResponse>, AppError> {
    let port: u16 = port
        .parse()
        .map_err(|_| AppError::bad_request("invalid port: must be a number between 1 and 65535"))?;

    if port == 0 {
        return Err(AppError::bad_request("port must be between 1 and 65535"));
    }

    if state.port_detector.has_port(port) {
        return Ok(Json(IsPortInUseResponse { is_in_use: true }));
    }

    let addr = format!("127.0.0.1:{port}");
    let in_use = tokio::time::timeout(
        std::time::Duration::from_millis(50),
        TcpStream::connect(&addr),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false);

    if in_use {
        state.port_detector.mark_in_use(port);
    }

    Ok(Json(IsPortInUseResponse { is_in_use: in_use }))
}
