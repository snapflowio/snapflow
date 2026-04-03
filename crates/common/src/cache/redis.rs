// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use redis::AsyncCommands;
use serde::{Deserialize, Serialize};

use super::{Cache, ValueObject};

pub struct RedisCache<T> {
    conn: redis::aio::MultiplexedConnection,
    prefix: String,
    _marker: std::marker::PhantomData<T>,
}

impl<T> RedisCache<T> {
    pub fn new(conn: redis::aio::MultiplexedConnection, prefix: impl Into<String>) -> Self {
        Self {
            conn,
            prefix: prefix.into(),
            _marker: std::marker::PhantomData,
        }
    }

    fn prefixed_key(&self, key: &str) -> String {
        format!("{}{}", self.prefix, key)
    }
}

impl<T> Cache<T> for RedisCache<T>
where
    T: Serialize + for<'de> Deserialize<'de> + Clone + Send + Sync + 'static,
{
    fn get(
        &self,
        key: &str,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<Option<T>>> + Send + '_>> {
        let full_key = self.prefixed_key(key);
        Box::pin(async move {
            let raw: Option<String> = self.conn.clone().get(&full_key).await?;
            match raw {
                Some(json) => {
                    let wrapper: ValueObject<T> = serde_json::from_str(&json)?;
                    Ok(Some(wrapper.value))
                }
                None => Ok(None),
            }
        })
    }

    fn set(
        &self,
        key: &str,
        value: &T,
        ttl: Duration,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + '_>> {
        let full_key = self.prefixed_key(key);
        let json = serde_json::to_string(&ValueObject { value });
        Box::pin(async move {
            let json = json?;
            let seconds = ttl.as_secs().max(1);
            self.conn
                .clone()
                .set_ex::<_, _, ()>(&full_key, json, seconds)
                .await?;
            Ok(())
        })
    }

    fn delete(&self, key: &str) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + '_>> {
        let full_key = self.prefixed_key(key);
        Box::pin(async move {
            self.conn.clone().del::<_, ()>(&full_key).await?;
            Ok(())
        })
    }

    fn has(&self, key: &str) -> Pin<Box<dyn Future<Output = anyhow::Result<bool>> + Send + '_>> {
        let full_key = self.prefixed_key(key);
        Box::pin(async move {
            let exists: bool = self.conn.clone().exists(&full_key).await?;
            Ok(exists)
        })
    }
}
