// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use crate::cache::ExecutorCache;
use crate::docker::DockerClient;
use crate::models::{CacheData, SandboxState};

pub struct SandboxService {
    cache: Arc<ExecutorCache>,
    docker: Arc<DockerClient>,
}

impl SandboxService {
    pub fn new(cache: Arc<ExecutorCache>, docker: Arc<DockerClient>) -> Self {
        Self { cache, docker }
    }

    pub async fn get_sandbox_states_info(&self, sandbox_id: &str) -> CacheData {
        let (state, _err) = self.docker.deduce_sandbox_state(sandbox_id).await;
        self.cache.set_sandbox_state(sandbox_id, state).await;

        self.cache.get_or_default(sandbox_id).await
    }

    pub async fn remove_destroyed_sandbox(&self, sandbox_id: &str) -> anyhow::Result<()> {
        let info = self.get_sandbox_states_info(sandbox_id).await;

        if info.sandbox_state != SandboxState::Destroyed
            && info.sandbox_state != SandboxState::Destroying
        {
            self.docker.destroy(sandbox_id).await?;
        }

        self.cache.remove(sandbox_id).await;
        Ok(())
    }
}
