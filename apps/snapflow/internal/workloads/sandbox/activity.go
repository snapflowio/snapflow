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

type inFlight struct {
	paymentHeld bool
}

type activity struct {
	mu         sync.Mutex
	converging map[string]inFlight
	suppressed map[string]uint64
}

func newActivity() *activity {
	return &activity{converging: make(map[string]inFlight), suppressed: make(map[string]uint64)}
}

func (activity *activity) begin(sandboxID string, target Target) {
	activity.mu.Lock()
	defer activity.mu.Unlock()
	activity.converging[sandboxID] = inFlight{paymentHeld: target.PaymentHeld}
}

func (activity *activity) end(sandboxID string) {
	activity.mu.Lock()
	defer activity.mu.Unlock()
	delete(activity.converging, sandboxID)
}

func (activity *activity) convergingSnapshot() map[string]inFlight {
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
