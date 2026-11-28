// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"sync"
	"sync/atomic"
)

const maximumFailureReasonLength = 500

type Health struct {
	failed atomic.Bool
	mu     sync.Mutex
	reason string
}

func (health *Health) Fail(reason string) {
	if len(reason) > maximumFailureReasonLength {
		reason = reason[:maximumFailureReasonLength]
	}
	health.mu.Lock()
	health.reason = reason
	health.mu.Unlock()
	health.failed.Store(true)
}

func (health *Health) Failure() (string, bool) {
	if !health.failed.Load() {
		return "", false
	}
	health.mu.Lock()
	defer health.mu.Unlock()
	return health.reason, true
}
