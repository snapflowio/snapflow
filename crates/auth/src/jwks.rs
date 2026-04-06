// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;
use std::time::Duration;

use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::DecodingKey;
use tokio::sync::RwLock;
use tracing::{info, warn};

#[derive(Clone)]
struct JwksKey {
    kid: Option<String>,
    key: DecodingKey,
}

pub struct JwksCache {
    keys: RwLock<Vec<JwksKey>>,
    http_client: reqwest::Client,
    api_url: String,
}

impl JwksCache {
    pub async fn new(http_client: reqwest::Client, api_url: String) -> Self {
        let keys = fetch_jwks(&http_client, &api_url).await;
        Self {
            keys: RwLock::new(keys),
            http_client,
            api_url,
        }
    }

    pub async fn get(&self) -> Option<DecodingKey> {
        self.keys.read().await.first().map(|k| k.key.clone())
    }

    pub async fn get_by_kid(&self, kid: Option<&str>) -> Option<DecodingKey> {
        let keys = self.keys.read().await;
        if keys.is_empty() {
            return None;
        }

        if let Some(kid) = kid {
            if let Some(matched) = keys.iter().find(|k| k.kid.as_deref() == Some(kid)) {
                return Some(matched.key.clone());
            }
        }

        keys.first().map(|k| k.key.clone())
    }

    pub async fn refresh(&self) {
        let new_keys = fetch_jwks(&self.http_client, &self.api_url).await;
        if !new_keys.is_empty() {
            *self.keys.write().await = new_keys;
        }
    }

    pub fn spawn_refresh_task(self: &Arc<Self>, interval_secs: u64) {
        let jwks = Arc::clone(self);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));
            interval.tick().await;
            loop {
                interval.tick().await;
                jwks.refresh().await;
            }
        });
    }
}

async fn fetch_jwks(client: &reqwest::Client, api_url: &str) -> Vec<JwksKey> {
    let url = format!("{}/.well-known/jwks.json", api_url);
    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "failed to fetch JWKS, JWT auth disabled");
            return Vec::default();
        }
    };

    let jwk_set: JwkSet = match resp.json().await {
        Ok(j) => j,
        Err(e) => {
            warn!(error = %e, "failed to parse JWKS response");
            return Vec::default();
        }
    };

    let mut result = Vec::default();

    for jwk in &jwk_set.keys {
        let kid = jwk.common.key_id.clone();
        let key = match DecodingKey::from_jwk(jwk) {
            Ok(k) => k,
            Err(e) => {
                warn!(error = %e, "failed to parse JWK entry, skipping");
                continue;
            }
        };

        result.push(JwksKey { kid, key });
    }

    if !result.is_empty() {
        info!(count = result.len(), "JWKS loaded, JWT auth enabled");
    }

    result
}
