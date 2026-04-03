// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;

#[derive(Debug, Clone, Envconfig)]
pub struct ProxyConfig {
    #[envconfig(from = "PROXY_DOMAIN", default = "proxy.localhost:4000")]
    pub domain: String,

    #[envconfig(from = "PROXY_PROTOCOL", default = "http")]
    pub protocol: String,

    #[envconfig(from = "PROXY_API_KEY", default = "")]
    pub api_key: String,
}

impl ProxyConfig {
    pub fn base_url(&self) -> String {
        format!("{}://{}", self.protocol, self.domain)
    }
}
