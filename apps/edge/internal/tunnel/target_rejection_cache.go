// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/tunnel-go/protocol"
	"github.com/snapflowio/tunnel-go/transport"
)

const cacheableTargetStatusCount = 2

func cacheableTargetStatuses() [cacheableTargetStatusCount]protocol.StreamOpenStatus {
	return [cacheableTargetStatusCount]protocol.StreamOpenStatus{
		protocol.StreamOpenStatusTargetUnavailable,
		protocol.StreamOpenStatusTargetCapacity,
	}
}

type negativeTargetKey struct {
	backendID            uuid.UUID
	assignmentGeneration uint32
	bindingID            uuid.UUID
	bindingRevision      uint64
	bindingDigest        string
	status               protocol.StreamOpenStatus
}

func (registry *Registry) hasNegativeTarget(
	route routes.Base,
	binding protocol.Binding,
	now time.Time,
) bool {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	return registry.hasNegativeTargetLocked(route, binding, now)
}

func (registry *Registry) hasNegativeTargetLocked(
	route routes.Base,
	binding protocol.Binding,
	now time.Time,
) bool {
	for _, status := range cacheableTargetStatuses() {
		key := newNegativeTargetKey(route, binding, status)
		expiresAt, exists := registry.negativeTargets[key]
		if !exists {
			continue
		}
		if now.Before(expiresAt) {
			return true
		}
		delete(registry.negativeTargets, key)
	}
	return false
}

func (registry *Registry) hasActiveNegativeTargetLocked(
	route routes.Base,
	binding protocol.Binding,
	now time.Time,
) bool {
	for _, status := range cacheableTargetStatuses() {
		expiresAt, exists := registry.negativeTargets[newNegativeTargetKey(route, binding, status)]
		if exists && now.Before(expiresAt) {
			return true
		}
	}
	return false
}

func (registry *Registry) recordTargetRejection(
	route routes.Base,
	binding protocol.Binding,
	err error,
	now time.Time,
) {
	var rejected *transport.StreamOpenRejectedError
	if !errors.As(err, &rejected) {
		return
	}
	cacheTTL, cacheable := negativeTargetCacheTTL(rejected.Status)
	if !cacheable {
		return
	}
	registry.mu.Lock()
	defer registry.mu.Unlock()
	registry.pruneNegativeTargetsLocked(now)
	if len(registry.negativeTargets) >= negativeTargetCacheLimit {
		return
	}
	registry.negativeTargets[newNegativeTargetKey(route, binding, rejected.Status)] = now.Add(cacheTTL)
}

func (registry *Registry) clearNegativeTarget(
	route routes.Base,
	binding protocol.Binding,
) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	for _, status := range cacheableTargetStatuses() {
		delete(registry.negativeTargets, newNegativeTargetKey(route, binding, status))
	}
}

func (registry *Registry) pruneNegativeTargetsLocked(now time.Time) {
	for key, expiresAt := range registry.negativeTargets {
		if !now.Before(expiresAt) {
			delete(registry.negativeTargets, key)
		}
	}
}

func newNegativeTargetKey(
	route routes.Base,
	binding protocol.Binding,
	status protocol.StreamOpenStatus,
) negativeTargetKey {
	return negativeTargetKey{
		backendID:            route.BackendID,
		assignmentGeneration: route.AssignmentGeneration,
		bindingID:            binding.ID,
		bindingRevision:      binding.Revision,
		bindingDigest:        binding.Digest,
		status:               status,
	}
}

func negativeTargetCacheTTL(status protocol.StreamOpenStatus) (time.Duration, bool) {
	switch status {
	case protocol.StreamOpenStatusTargetUnavailable:
		return targetUnavailableCacheTTL, true
	case protocol.StreamOpenStatusTargetCapacity:
		return targetCapacityCacheTTL, true
	default:
		return 0, false
	}
}
