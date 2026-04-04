// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;

#[derive(Debug, Clone, Envconfig)]
pub struct DefaultExecutorConfig {
    #[envconfig(from = "DEFAULT_EXECUTOR_DOMAIN", default = "")]
    pub domain: String,

    #[envconfig(from = "DEFAULT_EXECUTOR_API_KEY", default = "")]
    pub api_key: String,

    #[envconfig(from = "DEFAULT_EXECUTOR_PROXY_URL", default = "")]
    pub proxy_url: String,

    #[envconfig(from = "DEFAULT_EXECUTOR_API_URL", default = "")]
    pub api_url: String,

    #[envconfig(from = "DEFAULT_EXECUTOR_CPU", default = "8")]
    pub cpu: i32,

    #[envconfig(from = "DEFAULT_EXECUTOR_MEMORY_GIB", default = "16")]
    pub memory_gib: i32,

    #[envconfig(from = "DEFAULT_EXECUTOR_DISK_GIB", default = "100")]
    pub disk_gib: i32,

    #[envconfig(from = "DEFAULT_EXECUTOR_GPU", default = "0")]
    pub gpu: i32,

    #[envconfig(from = "DEFAULT_EXECUTOR_GPU_TYPE", default = "none")]
    pub gpu_type: String,

    #[envconfig(from = "DEFAULT_EXECUTOR_CLASS", default = "small")]
    pub class: String,

    #[envconfig(from = "DEFAULT_EXECUTOR_CAPACITY", default = "2")]
    pub capacity: i32,

    #[envconfig(from = "DEFAULT_EXECUTOR_REGION", default = "us")]
    pub region: String,

    #[envconfig(from = "DEFAULT_EXECUTOR_VERSION", default = "0")]
    pub version: String,

    #[envconfig(from = "DEFAULT_EXECUTOR_BOOTSTRAP", default = "true")]
    pub bootstrap: bool,
}

impl DefaultExecutorConfig {
    pub fn is_configured(&self) -> bool {
        !self.domain.is_empty() && !self.api_key.is_empty()
    }
}
