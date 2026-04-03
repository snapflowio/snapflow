// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use envconfig::Envconfig;

#[derive(Envconfig, Clone)]
pub struct Config {
    #[envconfig(from = "PROXY_PORT", default = "4000")]
    pub proxy_port: u16,

    #[envconfig(from = "PROXY_DOMAIN")]
    pub proxy_domain: String,

    #[envconfig(from = "PROXY_PROTOCOL")]
    pub proxy_protocol: String,

    #[envconfig(from = "PROXY_API_KEY")]
    pub proxy_api_key: String,

    #[envconfig(from = "SNAPFLOW_API_URL")]
    pub snapflow_api_url: String,

    #[envconfig(from = "ENABLE_TLS", default = "false")]
    pub enable_tls: bool,

    #[envconfig(from = "PREVIEW_WARNING_ENABLED", default = "false")]
    pub preview_warning_enabled: bool,

    #[envconfig(from = "RESTRICTED_MODE", default = "false")]
    pub restricted_mode: bool,

    #[envconfig(from = "OAUTH_CLIENT_ID", default = "snapflow-proxy")]
    pub oauth_client_id: String,

    #[envconfig(from = "OAUTH_AUTHORIZE_URL", default = "")]
    oauth_authorize_url_raw: String,

    #[envconfig(from = "OAUTH_TOKEN_URL", default = "")]
    oauth_token_url_raw: String,

    #[envconfig(from = "TLS_CERT_FILE", default = "")]
    tls_cert_file_raw: String,

    #[envconfig(from = "TLS_KEY_FILE", default = "")]
    tls_key_file_raw: String,

    #[envconfig(from = "COOKIE_DOMAIN", default = "")]
    cookie_domain_raw: String,

    #[envconfig(from = "REDIS_HOST", default = "")]
    redis_host_raw: String,

    #[envconfig(from = "REDIS_PORT", default = "6379")]
    pub redis_port: u16,

    #[envconfig(from = "REDIS_PASSWORD", default = "")]
    redis_password_raw: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self::init_from_env()?)
    }

    pub fn tls_cert_file(&self) -> Option<&str> {
        non_empty(&self.tls_cert_file_raw)
    }

    pub fn tls_key_file(&self) -> Option<&str> {
        non_empty(&self.tls_key_file_raw)
    }

    pub fn redis_host(&self) -> Option<&str> {
        non_empty(&self.redis_host_raw)
    }

    pub fn redis_password(&self) -> Option<&str> {
        non_empty(&self.redis_password_raw)
    }

    pub fn oauth_authorize_url(&self) -> Option<&str> {
        non_empty(&self.oauth_authorize_url_raw)
    }

    pub fn oauth_token_url(&self) -> Option<&str> {
        non_empty(&self.oauth_token_url_raw)
    }

    pub fn cookie_domain(&self) -> Option<String> {
        let base = non_empty(&self.cookie_domain_raw).unwrap_or(&self.proxy_domain);
        let host = base.split(':').next().unwrap_or(base);

        if host.ends_with(".localhost") || host == "localhost" {
            None
        } else {
            Some(format!(".{host}"))
        }
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        if self.proxy_domain.is_empty() {
            anyhow::bail!("PROXY_DOMAIN is required");
        }

        if self.proxy_protocol.is_empty() {
            anyhow::bail!("PROXY_PROTOCOL is required");
        }

        if self.proxy_api_key.is_empty() {
            anyhow::bail!("PROXY_API_KEY is required");
        }

        if self.snapflow_api_url.is_empty() {
            anyhow::bail!("SNAPFLOW_API_URL is required");
        }

        if self.enable_tls {
            if self.tls_cert_file().is_none() {
                anyhow::bail!("TLS_CERT_FILE is required when ENABLE_TLS is true");
            }

            if self.tls_key_file().is_none() {
                anyhow::bail!("TLS_KEY_FILE is required when ENABLE_TLS is true");
            }
        }

        Ok(())
    }
}

fn non_empty(s: &str) -> Option<&str> {
    if s.is_empty() { None } else { Some(s) }
}
