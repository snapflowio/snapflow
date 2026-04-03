// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;

#[derive(Debug, Clone, Envconfig)]
pub struct RedisConfig {
    #[envconfig(from = "REDIS_HOST", default = "localhost")]
    pub host: String,

    #[envconfig(from = "REDIS_PORT", default = "6379")]
    pub port: u16,

    #[envconfig(from = "REDIS_PASSWORD", default = "")]
    pub password: String,

    #[envconfig(from = "REDIS_TLS", default = "false")]
    pub tls: bool,
}

impl RedisConfig {
    pub fn connection_string(&self) -> String {
        let scheme = if self.tls { "rediss" } else { "redis" };

        if self.password.is_empty() {
            format!("{scheme}://{}:{}", self.host, self.port)
        } else {
            format!("{scheme}://:{}@{}:{}", self.password, self.host, self.port)
        }
    }
}
