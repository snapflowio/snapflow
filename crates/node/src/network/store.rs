// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

use std::collections::VecDeque;

use parking_lot::Mutex;
use tokio::sync::broadcast;

use super::types::NetworkEvent;

const BROADCAST_CAPACITY: usize = 1024;
const BUFFER_CAPACITY: usize = 10_000;

pub struct NetworkEventBroadcast {
    sender: broadcast::Sender<NetworkEvent>,
    buffer: Mutex<VecDeque<NetworkEvent>>,
}

impl NetworkEventBroadcast {
    pub fn default() -> Self {
        let (sender, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            sender,
            buffer: Mutex::new(VecDeque::with_capacity(BUFFER_CAPACITY)),
        }
    }

    pub fn send(&self, event: NetworkEvent) {
        {
            let mut buf = self.buffer.lock();
            if buf.len() >= BUFFER_CAPACITY {
                buf.pop_front();
            }
            buf.push_back(event.clone());
        }

        let _ = self.sender.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<NetworkEvent> {
        self.sender.subscribe()
    }

    pub fn recent_events(&self) -> Vec<NetworkEvent> {
        self.buffer.lock().iter().cloned().collect()
    }
}
