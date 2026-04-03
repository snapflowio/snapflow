// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;
use std::time::Duration;

use common_rs::cache::{Cache, memory::MemoryCache};
use dashmap::DashMap;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use tracing::{error, warn};

use crate::models::{BackupState, CacheData, SandboxState, SystemMetrics};

const SYSTEM_METRICS_KEY: &str = "__system_metrics__";

struct CacheInner {
    store: MemoryCache<CacheData>,
    locks: DashMap<String, Arc<Mutex<()>>>,
    retention: Duration,
}

pub struct ExecutorCache {
    inner: Arc<CacheInner>,
}

impl ExecutorCache {
    pub fn new(retention_days: u32, cancel: CancellationToken) -> Self {
        let days = if retention_days == 0 {
            7
        } else {
            retention_days
        };
        let inner = Arc::new(CacheInner {
            store: MemoryCache::default(),
            locks: DashMap::default(),
            retention: Duration::from_secs(u64::from(days) * 24 * 3600),
        });
        let cleanup_inner = Arc::clone(&inner);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300));
            loop {
                tokio::select! {
                    _ = cancel.cancelled() => {
                        return;
                    }
                    _ = interval.tick() => {
                        let lock_keys: Vec<String> = cleanup_inner
                            .locks
                            .iter()
                            .map(|entry| entry.key().clone())
                            .collect();
                        for key in lock_keys {
                            if key == SYSTEM_METRICS_KEY {
                                continue;
                            }
                            let exists = cleanup_inner
                                .store
                                .get(&key)
                                .await
                                .ok()
                                .flatten()
                                .is_some();
                            if !exists {
                                cleanup_inner.locks.remove(&key);
                            }
                        }
                    }
                }
            }
        });
        Self { inner }
    }

    fn get_lock(&self, key: &str) -> Arc<Mutex<()>> {
        self.inner
            .locks
            .entry(key.to_owned())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    pub async fn set_sandbox_state(&self, sandbox_id: &str, state: SandboxState) {
        let lock = self.get_lock(sandbox_id);
        let _guard = lock.lock().await;

        let mut data = self.get_or_default_inner(sandbox_id).await;
        data.sandbox_state = state;
        if let Err(e) = self
            .inner
            .store
            .set(sandbox_id, &data, self.inner.retention)
            .await
        {
            error!(
                sandbox_id = %sandbox_id,
                state = ?state,
                error = %e,
                "failed to persist sandbox state to cache"
            );
        }
    }

    pub async fn set_backup_state(
        &self,
        sandbox_id: &str,
        state: BackupState,
        error: Option<String>,
    ) {
        let lock = self.get_lock(sandbox_id);
        let _guard = lock.lock().await;

        let mut data = self.get_or_default_inner(sandbox_id).await;
        data.backup_state = state;
        data.backup_error = error;
        if let Err(e) = self
            .inner
            .store
            .set(sandbox_id, &data, self.inner.retention)
            .await
        {
            error!(
                sandbox_id = %sandbox_id,
                state = ?state,
                error = %e,
                "failed to persist backup state to cache"
            );
        }
    }

    pub async fn get_or_default(&self, sandbox_id: &str) -> CacheData {
        self.get_or_default_inner(sandbox_id).await
    }

    async fn get_or_default_inner(&self, sandbox_id: &str) -> CacheData {
        match self.inner.store.get(sandbox_id).await {
            Ok(Some(data)) => data,
            Ok(None) => CacheData::default(),
            Err(e) => {
                warn!(
                    sandbox_id = %sandbox_id,
                    error = %e,
                    "cache read error, returning default"
                );
                CacheData::default()
            }
        }
    }

    pub async fn remove(&self, sandbox_id: &str) {
        if let Err(e) = self.inner.store.delete(sandbox_id).await {
            warn!(
                sandbox_id = %sandbox_id,
                error = %e,
                "failed to remove cache entry"
            );
        }
        self.inner.locks.remove(sandbox_id);
    }

    pub async fn set_system_metrics(&self, metrics: SystemMetrics) {
        let data = CacheData {
            system_metrics: Some(metrics),
            ..Default::default()
        };
        if let Err(e) = self
            .inner
            .store
            .set(SYSTEM_METRICS_KEY, &data, Duration::from_secs(2 * 3600))
            .await
        {
            error!(error = %e, "failed to persist system metrics to cache");
        }
    }

    pub async fn get_system_metrics(&self) -> Option<SystemMetrics> {
        match self.inner.store.get(SYSTEM_METRICS_KEY).await {
            Ok(data) => data.and_then(|d| d.system_metrics),
            Err(e) => {
                warn!(error = %e, "failed to read system metrics from cache");
                None
            }
        }
    }
}
