// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use anyhow::{Context, Result};
use envconfig::Envconfig;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Envconfig)]
pub struct Config {
    #[envconfig(from = "API_TOKEN")]
    pub api_token: String,

    #[envconfig(from = "API_PORT", default = "8083")]
    pub api_port: u16,

    #[envconfig(from = "CACHE_RETENTION_DAYS", default = "7")]
    pub cache_retention_days: u32,

    #[envconfig(from = "ENVIRONMENT", default = "")]
    pub environment: String,

    #[envconfig(from = "CONTAINER_RUNTIME")]
    pub container_runtime: Option<String>,

    #[envconfig(from = "CONTAINER_NETWORK")]
    pub container_network: Option<String>,

    #[envconfig(from = "LOG_FILE_PATH")]
    pub log_file_path: Option<String>,

    #[envconfig(from = "LOG_LEVEL", default = "debug")]
    pub log_level: String,

    #[envconfig(from = "R2_REGION")]
    pub r2_region: Option<String>,

    #[envconfig(from = "R2_ENDPOINT_URL")]
    pub r2_endpoint_url: Option<String>,

    #[envconfig(from = "R2_ACCESS_KEY_ID")]
    pub r2_access_key_id: Option<String>,

    #[envconfig(from = "R2_SECRET_ACCESS_KEY")]
    pub r2_secret_access_key: Option<String>,

    #[envconfig(from = "R2_DEFAULT_BUCKET")]
    pub r2_default_bucket: Option<String>,

    #[envconfig(from = "TLS_CERT_FILE")]
    pub tls_cert_file: Option<String>,

    #[envconfig(from = "TLS_KEY_FILE")]
    pub tls_key_file: Option<String>,

    #[envconfig(from = "ENABLE_TLS")]
    pub enable_tls: Option<bool>,

    #[envconfig(from = "SERVER_URL")]
    pub server_url: Option<String>,

    #[envconfig(from = "RESOURCE_LIMITS_DISABLED", default = "false")]
    pub resource_limits_disabled: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let config: Config =
            Config::init_from_env().context("Failed to load configuration from environment")?;

        if config.api_token.is_empty() {
            anyhow::bail!("API_TOKEN is required");
        }

        Ok(config)
    }

    pub fn get_build_log_file_path(&self, image_ref: &str) -> Result<PathBuf> {
        let build_id = if let Some(pos) = image_ref.find(':') {
            &image_ref[..pos]
        } else {
            image_ref
        };

        let log_dir = if let Some(ref log_file_path) = self.log_file_path {
            Path::new(log_file_path)
                .parent()
                .unwrap_or_else(|| Path::new("/tmp"))
                .to_path_buf()
        } else {
            PathBuf::from("/tmp")
        };

        let log_path = log_dir.join("builds").join(build_id);

        if let Some(parent) = log_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create log directory: {}", parent.display()))?;
        }

        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .with_context(|| format!("Failed to create log file: {}", log_path.display()))?;

        Ok(log_path)
    }
}
