// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use redis::aio::{ConnectionManager, ConnectionManagerConfig};

use crate::config::RedisConfig;
use crate::constants::infra::{REDIS_CONNECTION_TIMEOUT, REDIS_RESPONSE_TIMEOUT};

pub async fn connect(config: &RedisConfig) -> Option<ConnectionManager> {
    if config.host.is_empty() {
        tracing::info!("redis not configured, skipping");
        return None;
    }

    let url = config.connection_string();
    tracing::info!(url = %url, "connecting to redis");

    let client = match redis::Client::open(url.as_str()) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(error = %e, "failed to create redis client");
            return None;
        }
    };

    let manager_config = ConnectionManagerConfig::default()
        .set_response_timeout(Some(REDIS_RESPONSE_TIMEOUT))
        .set_connection_timeout(Some(REDIS_CONNECTION_TIMEOUT));

    match client
        .get_connection_manager_with_config(manager_config)
        .await
    {
        Ok(conn) => {
            tracing::info!("redis connected (connection manager with auto-reconnect)");
            Some(conn)
        }
        Err(e) => {
            tracing::warn!(error = %e, "failed to connect to redis, continuing without it");
            None
        }
    }
}
