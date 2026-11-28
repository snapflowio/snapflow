// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"
	"sync"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"github.com/snapflowio/tunnel-go/reconnect"
)

type work struct {
	sandboxID string
	desired   *machinev1alpha1.SandboxDesiredState
	revision  uint64
	expiresAt time.Time
}

func (item work) authorized(now time.Time) bool {
	return now.Before(item.expiresAt)
}

type outcome int

const (
	outcomeSettled outcome = iota
	outcomeRetry
	outcomeRemoved
)

type syncFunc func(context.Context, work) outcome

type worker struct {
	pending *work
	wake    chan struct{}
}

type workerPool struct {
	ctx         context.Context
	synchronize syncFunc
	mu          sync.Mutex
	workers     map[string]*worker
	stopped     chan struct{}
	stopping    bool
	group       sync.WaitGroup
}

func newWorkerPool(ctx context.Context, synchronize syncFunc) *workerPool {
	return &workerPool{ctx: ctx, synchronize: synchronize, workers: make(map[string]*worker), stopped: make(chan struct{})}
}

func (pool *workerPool) update(item work) {
	pool.mu.Lock()
	defer pool.mu.Unlock()
	if pool.stopping {
		return
	}
	current, found := pool.workers[item.sandboxID]
	if !found {
		current = &worker{wake: make(chan struct{}, 1)}
		pool.workers[item.sandboxID] = current
		pool.group.Go(func() { pool.run(item.sandboxID, current) })
	}
	current.pending = &item
	select {
	case current.wake <- struct{}{}:
	default:
	}
}

func (pool *workerPool) stop() {
	pool.mu.Lock()
	if !pool.stopping {
		pool.stopping = true
		close(pool.stopped)
	}
	pool.mu.Unlock()
	pool.group.Wait()
}

func (pool *workerPool) run(sandboxID string, current *worker) {
	backoff := reconnect.DefaultBackoff()
	var retry *time.Timer
	var retryFired <-chan time.Time
	var last work
	for {
		select {
		case <-pool.stopped:
			stopTimer(retry)
			return
		case <-current.wake:
		case <-retryFired:
		}
		stopTimer(retry)
		retry, retryFired = nil, nil
		last = pool.take(current, last)
		switch pool.synchronize(pool.ctx, last) {
		case outcomeRetry:
			retry = time.NewTimer(backoff.Next())
			retryFired = retry.C
		case outcomeRemoved:
			if pool.retire(sandboxID, current) {
				return
			}
		default:
			backoff.Reset()
		}
	}
}

func (pool *workerPool) take(current *worker, last work) work {
	pool.mu.Lock()
	defer pool.mu.Unlock()
	if current.pending == nil {
		return last
	}
	item := *current.pending
	current.pending = nil
	return item
}

func (pool *workerPool) retire(sandboxID string, current *worker) bool {
	pool.mu.Lock()
	defer pool.mu.Unlock()
	if current.pending != nil {
		return false
	}
	delete(pool.workers, sandboxID)
	return true
}

func stopTimer(timer *time.Timer) {
	if timer != nil {
		timer.Stop()
	}
}
