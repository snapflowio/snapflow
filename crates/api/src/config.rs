// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

mod database;
mod default_executor;
mod executor_usage;
mod log;
mod proxy;
mod quota;
mod r2;
mod redis;
mod registry;
mod smtp;

pub use database::DatabaseConfig;
pub use default_executor::DefaultExecutorConfig;
pub use executor_usage::ExecutorUsageConfig;
pub use log::LogConfig;
pub use proxy::ProxyConfig;
pub use quota::DefaultOrganizationQuota;
pub use r2::R2Config;
pub use redis::RedisConfig;
pub use registry::{InternalRegistryConfig, TransientRegistryConfig};
pub use smtp::SmtpConfig;

use envconfig::Envconfig;
use validator::Validate;

#[derive(Debug, Clone, Envconfig, Validate)]
pub struct AppConfig {
    #[envconfig(from = "PORT", default = "8081")]
    pub port: u16,

    #[envconfig(from = "ENVIRONMENT", default = "development")]
    #[validate(length(min = 1))]
    pub environment: String,

    #[envconfig(from = "API_URL", default = "http://localhost:8081")]
    #[validate(url)]
    pub api_url: String,

    #[envconfig(from = "WEBSITE_URL", default = "http://localhost:3000")]
    #[validate(url)]
    pub website_url: String,

    #[envconfig(from = "DASHBOARD_URL", default = "http://localhost:3000/dashboard")]
    pub dashboard_url: String,

    #[envconfig(from = "JWT_PRIVATE_KEY")]
    #[validate(length(min = 1))]
    pub jwt_private_key: String,

    #[envconfig(from = "DEFAULT_IMAGE", default = "snapflowio/snapflow:0.1.2")]
    pub default_image: String,

    #[envconfig(from = "MAINTENANCE_MODE", default = "false")]
    pub maintenance_mode: bool,

    #[envconfig(from = "MAX_AUTO_ARCHIVE_INTERVAL", default = "43200")]
    pub max_auto_archive_interval: u64,

    #[envconfig(from = "MAX_CONCURRENT_ARCHIVES_PER_EXECUTOR", default = "6")]
    pub max_concurrent_archives_per_executor: u32,

    #[envconfig(nested = true)]
    pub database: DatabaseConfig,

    #[envconfig(nested = true)]
    pub redis: RedisConfig,

    #[envconfig(nested = true)]
    pub smtp: SmtpConfig,

    #[envconfig(nested = true)]
    pub r2: R2Config,

    #[envconfig(nested = true)]
    pub proxy: ProxyConfig,

    #[envconfig(nested = true)]
    pub log: LogConfig,

    #[envconfig(nested = true)]
    pub transient_registry: TransientRegistryConfig,

    #[envconfig(nested = true)]
    pub internal_registry: InternalRegistryConfig,

    #[envconfig(nested = true)]
    pub default_executor: DefaultExecutorConfig,

    #[envconfig(nested = true)]
    pub quota: DefaultOrganizationQuota,

    #[envconfig(nested = true)]
    pub executor_usage: ExecutorUsageConfig,
}

impl AppConfig {
    pub fn load() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();
        let config = Self::init_from_env()?;
        config.validate()?;
        Ok(config)
    }

    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }
}
