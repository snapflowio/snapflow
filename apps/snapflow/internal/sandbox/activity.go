// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"maps"
	"sync"
)

type activity struct {
	mu         sync.Mutex
	converging map[string]bool
	suppressed map[string]uint64
}

func newActivity() *activity {
	return &activity{converging: make(map[string]bool), suppressed: make(map[string]uint64)}
}

func (activity *activity) begin(sandboxID string) {
	activity.mu.Lock()
	defer activity.mu.Unlock()
	activity.converging[sandboxID] = true
}

func (activity *activity) end(sandboxID string) {
	activity.mu.Lock()
	defer activity.mu.Unlock()
	delete(activity.converging, sandboxID)
}

func (activity *activity) convergingSnapshot() map[string]bool {
	activity.mu.Lock()
	defer activity.mu.Unlock()
	return maps.Clone(activity.converging)
}

func (activity *activity) suppress(sandboxID string, revision uint64) {
	activity.mu.Lock()
	defer activity.mu.Unlock()
	activity.suppressed[sandboxID] = revision
}

func (activity *activity) isSuppressed(sandboxID string, revision uint64) bool {
	activity.mu.Lock()
	defer activity.mu.Unlock()
	suppressedAt, found := activity.suppressed[sandboxID]
	if found && revision > suppressedAt {
		delete(activity.suppressed, sandboxID)
		return false
	}
	return found
}

type LocalRuntimes struct {
	mu   sync.Mutex
	held map[string]int
}

func NewLocalRuntimes() *LocalRuntimes {
	return &LocalRuntimes{held: make(map[string]int)}
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
			}
		})
	}
}

func (local *LocalRuntimes) isHeld(sandboxID string) bool {
	local.mu.Lock()
	defer local.mu.Unlock()
	return local.held[sandboxID] > 0
}
