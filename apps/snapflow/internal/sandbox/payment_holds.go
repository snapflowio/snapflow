// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import "sync"

// PaymentHolds are the sandboxes this machine pauses because their customer
// stopped paying. The settlement watchdog decides; the converger is the only
// component that pauses or resumes the runtime, so a hold never races the
// desired state: a held sandbox the API wants started stays paused, while a
// stop or destroy from the API still converges.
type PaymentHolds struct {
	mu      sync.Mutex
	held    map[string]bool
	changed chan struct{}
}

func NewPaymentHolds() *PaymentHolds {
	return &PaymentHolds{held: make(map[string]bool), changed: make(chan struct{}, 1)}
}

// Set holds or releases a sandbox and wakes convergence when that changed.
func (holds *PaymentHolds) Set(sandboxID string, held bool) {
	holds.mu.Lock()
	defer holds.mu.Unlock()
	if holds.held[sandboxID] == held {
		return
	}
	if held {
		holds.held[sandboxID] = true
	} else {
		delete(holds.held, sandboxID)
	}
	select {
	case holds.changed <- struct{}{}:
	default:
	}
}

func (holds *PaymentHolds) Held(sandboxID string) bool {
	holds.mu.Lock()
	defer holds.mu.Unlock()
	return holds.held[sandboxID]
}
