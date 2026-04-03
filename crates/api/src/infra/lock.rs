// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::time::Duration;

use redis::AsyncCommands;

use crate::constants::infra::DEFAULT_LOCK_POLL_INTERVAL;
use snapflow_errors::{AppError, Result};

const UNLOCK_SCRIPT: &str = r#"
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"#;

fn redis_err(op: &str, e: redis::RedisError) -> AppError {
    AppError::Internal(format!("redis {op} error: {e}"))
}

fn generate_lock_code() -> String {
    let bytes: [u8; 16] = rand::random();
    hex::encode(bytes)
}

#[derive(Clone)]
pub struct RedisLock {
    conn: redis::aio::ConnectionManager,
}

impl RedisLock {
    pub fn new(conn: redis::aio::ConnectionManager) -> Self {
        Self { conn }
    }

    /// Acquire a lock with an auto-generated code. Returns `Some(code)` on success.
    pub async fn lock(&self, key: &str, ttl_secs: u64) -> Result<Option<String>> {
        let code = generate_lock_code();
        if self.lock_with_code(key, ttl_secs, &code).await? {
            Ok(Some(code))
        } else {
            Ok(None)
        }
    }

    pub async fn lock_with_code(&self, key: &str, ttl_secs: u64, code: &str) -> Result<bool> {
        let result: Option<String> = redis::cmd("SET")
            .arg(key)
            .arg(code)
            .arg("EX")
            .arg(ttl_secs)
            .arg("NX")
            .query_async(&mut self.conn.clone())
            .await
            .map_err(|e| redis_err("lock", e))?;

        Ok(result.is_some())
    }

    /// Safe unlock: only deletes if the stored value matches `code`.
    pub async fn unlock(&self, key: &str, code: &str) -> Result<bool> {
        let result: i32 = redis::Script::new(UNLOCK_SCRIPT)
            .key(key)
            .arg(code)
            .invoke_async(&mut self.conn.clone())
            .await
            .map_err(|e| redis_err("unlock", e))?;

        Ok(result == 1)
    }

    /// Force-delete a lock regardless of owner. Use sparingly.
    pub async fn force_unlock(&self, key: &str) -> Result<()> {
        self.conn
            .clone()
            .del::<_, ()>(key)
            .await
            .map_err(|e| redis_err("force_unlock", e))?;
        Ok(())
    }

    pub async fn is_locked(&self, key: &str) -> Result<bool> {
        let exists: bool = self
            .conn
            .clone()
            .exists(key)
            .await
            .map_err(|e| redis_err("exists", e))?;
        Ok(exists)
    }

    pub async fn get_code(&self, key: &str) -> Result<Option<String>> {
        let value: Option<String> = self
            .conn
            .clone()
            .get(key)
            .await
            .map_err(|e| redis_err("get", e))?;
        Ok(value)
    }

    pub async fn refresh(&self, key: &str, ttl_secs: u64, code: &str) -> Result<()> {
        self.conn
            .clone()
            .set_ex::<_, _, ()>(key, code, ttl_secs)
            .await
            .map_err(|e| redis_err("refresh", e))?;
        Ok(())
    }

    pub async fn wait_for_lock(&self, key: &str, ttl_secs: u64) -> Result<String> {
        self.wait_for_lock_with_interval(key, ttl_secs, DEFAULT_LOCK_POLL_INTERVAL)
            .await
    }

    pub async fn wait_for_lock_with_interval(
        &self,
        key: &str,
        ttl_secs: u64,
        interval: Duration,
    ) -> Result<String> {
        loop {
            if let Some(code) = self.lock(key, ttl_secs).await? {
                return Ok(code);
            }
            tokio::time::sleep(interval).await;
        }
    }

    pub async fn wait_for_lock_timeout(
        &self,
        key: &str,
        ttl_secs: u64,
        timeout: Duration,
    ) -> Result<Option<String>> {
        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            if let Some(code) = self.lock(key, ttl_secs).await? {
                return Ok(Some(code));
            }
            if tokio::time::Instant::now() >= deadline {
                return Ok(None);
            }
            tokio::time::sleep(DEFAULT_LOCK_POLL_INTERVAL).await;
        }
    }

    pub async fn acquire(&self, key: &str, ttl_secs: u64) -> Result<Option<LockGuard<'_>>> {
        if let Some(code) = self.lock(key, ttl_secs).await? {
            Ok(Some(LockGuard::new(self, key.to_owned(), code)))
        } else {
            Ok(None)
        }
    }

    pub async fn acquire_wait(&self, key: &str, ttl_secs: u64) -> Result<LockGuard<'_>> {
        let code = self.wait_for_lock(key, ttl_secs).await?;
        Ok(LockGuard::new(self, key.to_owned(), code))
    }

    pub async fn acquire_wait_timeout(
        &self,
        key: &str,
        ttl_secs: u64,
        timeout: Duration,
    ) -> Result<Option<LockGuard<'_>>> {
        if let Some(code) = self.wait_for_lock_timeout(key, ttl_secs, timeout).await? {
            Ok(Some(LockGuard::new(self, key.to_owned(), code)))
        } else {
            Ok(None)
        }
    }

    pub async fn get_counter(&self, key: &str) -> Result<i64> {
        let value: Option<i64> = self
            .conn
            .clone()
            .get(key)
            .await
            .map_err(|e| redis_err("get_counter", e))?;
        Ok(value.unwrap_or(0))
    }

    pub async fn increment_counter(&self, key: &str, ttl_secs: u64) -> Result<i64> {
        let mut conn = self.conn.clone();
        let value: i64 = conn
            .incr(key, 1i64)
            .await
            .map_err(|e| redis_err("incr", e))?;
        conn.expire::<_, ()>(key, ttl_secs as i64)
            .await
            .map_err(|e| redis_err("expire", e))?;
        Ok(value)
    }
}

pub struct LockGuard<'a> {
    lock: &'a RedisLock,
    key: String,
    code: String,
    released: bool,
}

impl<'a> LockGuard<'a> {
    fn new(lock: &'a RedisLock, key: String, code: String) -> Self {
        Self {
            lock,
            key,
            code,
            released: false,
        }
    }

    pub async fn release(&mut self) -> Result<()> {
        if !self.released {
            self.released = true;
            self.lock.unlock(&self.key, &self.code).await?;
        }
        Ok(())
    }

    pub async fn refresh(&self, ttl_secs: u64) -> Result<()> {
        self.lock.refresh(&self.key, ttl_secs, &self.code).await
    }

    pub fn key(&self) -> &str {
        &self.key
    }

    pub fn code(&self) -> &str {
        &self.code
    }
}

impl Drop for LockGuard<'_> {
    fn drop(&mut self) {
        if !self.released {
            let conn = self.lock.conn.clone();
            let key = self.key.clone();
            let code = self.code.clone();
            if let Ok(handle) = tokio::runtime::Handle::try_current() {
                handle.spawn(async move {
                    let result: std::result::Result<i32, redis::RedisError> =
                        redis::Script::new(UNLOCK_SCRIPT)
                            .key(&key)
                            .arg(&code)
                            .invoke_async(&mut conn.clone())
                            .await;
                    if let Err(e) = result {
                        tracing::warn!(
                            key = %key,
                            error = %e,
                            "failed to release lock in drop"
                        );
                    }
                });
            }
        }
    }
}
