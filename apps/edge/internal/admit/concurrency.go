// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admit

import (
	"net/netip"
	"sync"
	"sync/atomic"
)

type scopeLimits struct {
	global             int
	interactiveReserve int
	perSource          int
	perOwner           int
	perRoute           int
	perBinding         int
}

type scopeLimiter struct {
	global         chan struct{}
	nonInteractive chan struct{}
	perSource      *keyedCounter[netip.Addr]
	perOwner       *keyedCounter[string]
	perRoute       *keyedCounter[string]
	perBinding     *keyedCounter[string]
	active         atomic.Int64
}

func newScopeLimiter(limits scopeLimits) *scopeLimiter {
	return &scopeLimiter{
		global:         make(chan struct{}, limits.global),
		nonInteractive: make(chan struct{}, limits.global-limits.interactiveReserve),
		perSource:      newKeyedCounter[netip.Addr](limits.perSource),
		perOwner:       newKeyedCounter[string](limits.perOwner),
		perRoute:       newKeyedCounter[string](limits.perRoute),
		perBinding:     newKeyedCounter[string](limits.perBinding),
	}
}

func (limiter *scopeLimiter) acquire(
	source netip.Addr,
	scope Scope,
) (*Permit, bool) {
	if !limiter.acquireGlobal(scope.Interactive) {
		return nil, false
	}
	if !limiter.acquireScopes(source, scope) {
		limiter.releaseGlobal(scope.Interactive)
		return nil, false
	}
	limiter.active.Add(1)
	return &Permit{
		release: func() {
			limiter.releaseScopes(source, scope)
			limiter.releaseGlobal(scope.Interactive)
			limiter.active.Add(-1)
		},
	}, true
}

func (limiter *scopeLimiter) acquireGlobal(interactive bool) bool {
	if !interactive {
		select {
		case limiter.nonInteractive <- struct{}{}:
		default:
			return false
		}
	}
	select {
	case limiter.global <- struct{}{}:
		return true
	default:
		if !interactive {
			<-limiter.nonInteractive
		}
		return false
	}
}

func (limiter *scopeLimiter) releaseGlobal(interactive bool) {
	<-limiter.global
	if !interactive {
		<-limiter.nonInteractive
	}
}

func (limiter *scopeLimiter) acquireScopes(source netip.Addr, scope Scope) bool {
	if !limiter.perSource.acquire(source) {
		return false
	}
	if !limiter.perOwner.acquire(scope.Owner) {
		limiter.perSource.release(source)
		return false
	}
	if !limiter.perRoute.acquire(scope.Route) {
		limiter.perOwner.release(scope.Owner)
		limiter.perSource.release(source)
		return false
	}
	if !limiter.perBinding.acquire(scope.Binding) {
		limiter.perRoute.release(scope.Route)
		limiter.perOwner.release(scope.Owner)
		limiter.perSource.release(source)
		return false
	}
	return true
}

func (limiter *scopeLimiter) releaseScopes(source netip.Addr, scope Scope) {
	limiter.perBinding.release(scope.Binding)
	limiter.perRoute.release(scope.Route)
	limiter.perOwner.release(scope.Owner)
	limiter.perSource.release(source)
}

func (limiter *scopeLimiter) headroom(limit int) int64 {
	return max(int64(limit)-limiter.active.Load(), 0)
}

type Permit struct {
	once    sync.Once
	release func()
}

func (permit *Permit) Release() {
	if permit == nil {
		return
	}
	permit.once.Do(permit.release)
}

type keyedCounter[K comparable] struct {
	mu      sync.Mutex
	entries map[K]int
	limit   int
}

func newKeyedCounter[K comparable](limit int) *keyedCounter[K] {
	return &keyedCounter[K]{entries: make(map[K]int), limit: limit}
}

func (counter *keyedCounter[K]) acquire(key K) bool {
	counter.mu.Lock()
	defer counter.mu.Unlock()
	if counter.entries[key] >= counter.limit {
		return false
	}
	counter.entries[key]++
	return true
}

func (counter *keyedCounter[K]) release(key K) {
	counter.mu.Lock()
	defer counter.mu.Unlock()
	if count := counter.entries[key]; count <= 1 {
		delete(counter.entries, key)
	} else {
		counter.entries[key] = count - 1
	}
}
