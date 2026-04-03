// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::sync::Arc;

use dashmap::DashMap;
use tokio::sync::{broadcast, watch};
use uuid::Uuid;

use snapflow_models::{BucketState, ImageState, SandboxState};

#[derive(Debug, Clone)]
pub enum Event {
    SandboxCreated {
        sandbox_id: Uuid,
        organization_id: Uuid,
    },
    SandboxStateUpdated {
        sandbox_id: Uuid,
        organization_id: Uuid,
        old_state: SandboxState,
        new_state: SandboxState,
    },
    SandboxStarted {
        sandbox_id: Uuid,
        organization_id: Uuid,
    },
    SandboxStopped {
        sandbox_id: Uuid,
        organization_id: Uuid,
    },
    SandboxDestroyed {
        sandbox_id: Uuid,
        organization_id: Uuid,
    },
    SandboxArchived {
        sandbox_id: Uuid,
        organization_id: Uuid,
    },
    SandboxDesiredStateUpdated {
        sandbox_id: Uuid,
        organization_id: Uuid,
    },
    SandboxBackupCompleted {
        sandbox_id: Uuid,
        organization_id: Uuid,
    },
    SandboxBackupFailed {
        sandbox_id: Uuid,
        organization_id: Uuid,
    },
    ImageStateUpdated {
        image_id: Uuid,
        organization_id: Option<Uuid>,
        old_state: ImageState,
        new_state: ImageState,
    },
    BucketStateUpdated {
        bucket_id: Uuid,
        organization_id: Option<Uuid>,
        old_state: BucketState,
        new_state: BucketState,
    },
    OrganizationSuspended {
        organization_id: Uuid,
    },
}

#[derive(Clone)]
pub struct EventBus {
    global: broadcast::Sender<Event>,
    sandbox_watchers: Arc<DashMap<Uuid, watch::Sender<SandboxState>>>,
}

impl EventBus {
    pub fn new() -> Self {
        let (global, _) = broadcast::channel(512);
        Self {
            global,
            sandbox_watchers: Arc::new(DashMap::default()),
        }
    }

    pub fn emit(&self, event: Event) {
        if let Event::SandboxStateUpdated {
            sandbox_id,
            new_state,
            ..
        } = &event
            && let Some(tx) = self.sandbox_watchers.get(sandbox_id)
        {
            let _ = tx.send(*new_state);
        }

        let _ = self.global.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.global.subscribe()
    }

    pub fn watch_sandbox(
        &self,
        sandbox_id: Uuid,
        initial_state: SandboxState,
    ) -> SandboxWatchGuard {
        let rx = self
            .sandbox_watchers
            .entry(sandbox_id)
            .or_insert_with(|| watch::channel(initial_state).0)
            .subscribe();

        SandboxWatchGuard {
            rx,
            sandbox_id,
            watchers: Arc::clone(&self.sandbox_watchers),
        }
    }
}

pub struct SandboxWatchGuard {
    pub rx: watch::Receiver<SandboxState>,
    sandbox_id: Uuid,
    watchers: Arc<DashMap<Uuid, watch::Sender<SandboxState>>>,
}

impl Drop for SandboxWatchGuard {
    fn drop(&mut self) {
        self.watchers
            .remove_if(&self.sandbox_id, |_, tx| tx.receiver_count() <= 1);
    }
}
