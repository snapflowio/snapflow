// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use reqwest::Client;
use snapflow_api_client::apis::configuration::Configuration as ApiConfiguration;
use tracing::{info, warn};

use common_rs::cache::{Cache, memory::MemoryCache, redis::RedisCache};

use crate::{config::Config, routes::proxy::ExecutorInfo};

pub type SharedState = Arc<AppState>;

pub struct AppState {
    pub config: Config,
    pub api_config: ApiConfiguration,
    pub http_client: Client,
    pub executor_cache: Box<dyn Cache<ExecutorInfo>>,
    pub sandbox_public_cache: Box<dyn Cache<bool>>,
    pub auth_key_cache: Box<dyn Cache<bool>>,
    pub last_activity_cache: Box<dyn Cache<bool>>,
    /// Stores OAuth nonces for CSRF protection. Key: nonce, Value: true.
    pub nonce_cache: Box<dyn Cache<bool>>,
}

pub async fn build_state(config: Config) -> anyhow::Result<SharedState> {
    let http_client = Client::builder().build()?;

    let api_config = ApiConfiguration {
        base_path: config.snapflow_api_url.clone(),
        bearer_access_token: Some(config.proxy_api_key.clone()),
        client: http_client.clone(),
        ..ApiConfiguration::default()
    };

    type CacheBox<T> = Box<dyn Cache<T>>;

    let (executor_cache, sandbox_public_cache, auth_key_cache, last_activity_cache, nonce_cache): (
        CacheBox<ExecutorInfo>,
        CacheBox<bool>,
        CacheBox<bool>,
        CacheBox<bool>,
        CacheBox<bool>,
    ) = match try_connect_redis(&config).await {
        Some(conn) => {
            let ec = RedisCache::new(conn.clone(), "proxy:sandbox-executor-info:");
            let spc = RedisCache::new(conn.clone(), "proxy:sandbox-public:");
            let akc = RedisCache::new(conn.clone(), "proxy:sandbox-auth-key-valid:");
            let lac = RedisCache::new(conn.clone(), "proxy:sandbox-last-activity:");
            let nc = RedisCache::new(conn, "proxy:oauth-nonce:");
            (
                Box::new(ec),
                Box::new(spc),
                Box::new(akc),
                Box::new(lac),
                Box::new(nc),
            )
        }
        None => {
            let ec: MemoryCache<ExecutorInfo> = MemoryCache::default();
            let spc: MemoryCache<bool> = MemoryCache::default();
            let akc: MemoryCache<bool> = MemoryCache::default();
            let lac: MemoryCache<bool> = MemoryCache::default();
            let nc: MemoryCache<bool> = MemoryCache::default();
            (
                Box::new(ec),
                Box::new(spc),
                Box::new(akc),
                Box::new(lac),
                Box::new(nc),
            )
        }
    };

    let state = Arc::new(AppState {
        config,
        api_config,
        http_client,
        executor_cache,
        sandbox_public_cache,
        auth_key_cache,
        last_activity_cache,
        nonce_cache,
    });

    Ok(state)
}

async fn try_connect_redis(config: &Config) -> Option<redis::aio::MultiplexedConnection> {
    let host = config.redis_host()?;
    let password = config.redis_password().unwrap_or("");
    let auth = if password.is_empty() {
        String::default()
    } else {
        format!(":{password}@")
    };
    let redis_url = format!("redis://{auth}{host}:{}/", config.redis_port);

    info!(host, port = config.redis_port, "connecting to Redis");

    let client = match redis::Client::open(redis_url.as_str()) {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "failed to create Redis client, falling back to in-memory cache");
            return None;
        }
    };

    match client.get_multiplexed_async_connection().await {
        Ok(conn) => {
            info!("connected to Redis");
            Some(conn)
        }
        Err(e) => {
            warn!(error = %e, "failed to connect to Redis, falling back to in-memory cache");
            None
        }
    }
}
