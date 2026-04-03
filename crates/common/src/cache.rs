// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

pub mod memory;
#[cfg(feature = "redis")]
pub mod redis;

use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

pub trait Cache<T: Send + Sync>: Send + Sync {
    fn get(
        &self,
        key: &str,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<Option<T>>> + Send + '_>>;
    fn set(
        &self,
        key: &str,
        value: &T,
        ttl: Duration,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + '_>>;
    fn delete(&self, key: &str) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + '_>>;
    fn has(&self, key: &str) -> Pin<Box<dyn Future<Output = anyhow::Result<bool>> + Send + '_>>;
}

#[cfg(feature = "redis")]
#[derive(serde::Serialize, serde::Deserialize)]
pub(crate) struct ValueObject<T> {
    pub value: T,
}
