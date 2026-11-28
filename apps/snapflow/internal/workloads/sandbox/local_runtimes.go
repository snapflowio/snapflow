// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"sync"
	"time"
)

const releasedLocalRuntimeMemory = 10 * time.Minute

type LocalRuntimes struct {
	mu       sync.Mutex
	held     map[string]int
	released map[string]time.Time
}

func NewLocalRuntimes() *LocalRuntimes {
	return &LocalRuntimes{held: make(map[string]int), released: make(map[string]time.Time)}
}

func (local *LocalRuntimes) Hold(sandboxID string) (release func()) {
	local.mu.Lock()
	defer local.mu.Unlock()
	local.held[sandboxID]++
	var once sync.Once
	return func() {
		once.Do(func() {
			local.mu.Lock()
			defer local.mu.Unlock()
			local.held[sandboxID]--
			if local.held[sandboxID] <= 0 {
				delete(local.held, sandboxID)
				local.released[sandboxID] = time.Now()
			}
		})
	}
}

func (local *LocalRuntimes) Local(sandboxID string) bool {
	local.mu.Lock()
	defer local.mu.Unlock()
	now := time.Now()
	for id, releasedAt := range local.released {
		if now.Sub(releasedAt) > releasedLocalRuntimeMemory {
			delete(local.released, id)
		}
	}
	_, recent := local.released[sandboxID]
	return local.held[sandboxID] > 0 || recent
}

func (local *LocalRuntimes) isHeld(sandboxID string) bool {
	local.mu.Lock()
	defer local.mu.Unlock()
	return local.held[sandboxID] > 0
}
