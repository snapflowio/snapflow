// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::PathBuf;

pub const TOOLBOX_API_PORT: u16 = 8082;
pub const TERMINAL_PORT: u16 = 22222;
const DEFAULT_DNS_UPSTREAM: SocketAddr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)), 53);

#[derive(Envconfig, Clone)]
pub struct Config {
    #[envconfig(
        from = "SNAPFLOW_NODE_LOG_FILE_PATH",
        default = "/tmp/snapflow-node.log"
    )]
    log_file_path_raw: String,

    #[envconfig(from = "SNAPFLOW_PROJECT_DIR", default = "")]
    project_dir_raw: String,

    #[envconfig(from = "LOG_LEVEL", default = "debug")]
    pub log_level: String,

    #[envconfig(from = "HOME", default = "/root")]
    pub home: String,

    #[envconfig(from = "SNAPFLOW_AUTH_TOKEN", default = "")]
    pub auth_token: String,

    #[envconfig(from = "SNAPFLOW_DNS_UPSTREAM", default = "")]
    dns_upstream_raw: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self::init_from_env()?)
    }

    pub fn log_file_path(&self) -> Option<String> {
        let path = non_empty(&self.log_file_path_raw)?;
        Some(path.replace("(HOME)", &self.home))
    }

    pub fn project_dir(&self) -> PathBuf {
        non_empty(&self.project_dir_raw)
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(&self.home))
    }

    pub fn config_dir(&self) -> PathBuf {
        PathBuf::from(&self.home).join(".snapflow")
    }

    pub fn dns_upstream(&self) -> SocketAddr {
        non_empty(&self.dns_upstream_raw)
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_DNS_UPSTREAM)
    }
}

fn non_empty(s: &str) -> Option<&str> {
    if s.is_empty() { None } else { Some(s) }
}
