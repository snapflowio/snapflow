// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use dashmap::DashMap;

use super::Cache;

const CLEANUP_INTERVAL: u64 = 100;

pub struct MemoryCache<T> {
    map: DashMap<String, (T, Instant)>,
    set_counter: AtomicU64,
}

impl<T: Clone + Send + Sync> Default for MemoryCache<T> {
    fn default() -> Self {
        Self {
            map: DashMap::default(),
            set_counter: AtomicU64::new(0),
        }
    }
}

impl<T: Clone + Send + Sync> MemoryCache<T> {
    pub fn cleanup(&self) {
        let now = Instant::now();
        self.map.retain(|_, (_, exp)| now < *exp);
    }
}

impl<T: Clone + Send + Sync + 'static> Cache<T> for MemoryCache<T> {
    fn get(
        &self,
        key: &str,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<Option<T>>> + Send + '_>> {
        let key = key.to_owned();
        Box::pin(async move {
            if let Some(entry) = self.map.get(&key) {
                let (value, expires_at) = entry.value();
                if Instant::now() < *expires_at {
                    return Ok(Some(value.clone()));
                }
                drop(entry);
                self.map
                    .remove_if(&key, |_, (_, exp)| Instant::now() >= *exp);
            }
            Ok(None)
        })
    }

    fn set(
        &self,
        key: &str,
        value: &T,
        ttl: Duration,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + '_>> {
        let key = key.to_owned();
        let value = value.clone();
        Box::pin(async move {
            self.map.insert(key, (value, Instant::now() + ttl));

            if self
                .set_counter
                .fetch_add(1, Ordering::Relaxed)
                .is_multiple_of(CLEANUP_INTERVAL)
            {
                self.cleanup();
            }

            Ok(())
        })
    }

    fn delete(&self, key: &str) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + '_>> {
        let key = key.to_owned();
        Box::pin(async move {
            self.map.remove(&key);
            Ok(())
        })
    }

    fn has(&self, key: &str) -> Pin<Box<dyn Future<Output = anyhow::Result<bool>> + Send + '_>> {
        let key = key.to_owned();
        Box::pin(async move {
            if let Some(entry) = self.map.get(&key) {
                let (_, expires_at) = entry.value();
                if Instant::now() < *expires_at {
                    return Ok(true);
                }
                drop(entry);
                self.map
                    .remove_if(&key, |_, (_, exp)| Instant::now() >= *exp);
            }
            Ok(false)
        })
    }
}
