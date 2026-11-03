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
	"sync/atomic"
	"testing"
	"time"
)

const (
	coalescedUpdates = 5
	workerDeadline   = 5 * time.Second
)

func TestWorkersSerializeEachSandboxAndCoalesceToTheNewestWork(t *testing.T) {
	release := make(chan struct{})
	started := make(chan struct{}, 1)
	var running atomic.Int32
	var overlapped atomic.Bool
	var mu sync.Mutex
	var seen []uint64
	pool := newWorkerPool(t.Context(), func(ctx context.Context, item work) outcome {
		if running.Add(1) > 1 {
			overlapped.Store(true)
		}
		defer running.Add(-1)
		mu.Lock()
		seen = append(seen, item.revision)
		first := len(seen) == 1
		mu.Unlock()
		if first {
			started <- struct{}{}
			<-release
		}
		return outcomeSettled
	})
	pool.update(work{sandboxID: testSandboxID, revision: 1})
	<-started
	for revision := uint64(2); revision <= coalescedUpdates; revision++ {
		pool.update(work{sandboxID: testSandboxID, revision: revision})
	}
	close(release)
	deadline := time.Now().Add(workerDeadline)
	for {
		mu.Lock()
		count := len(seen)
		mu.Unlock()
		if count == 2 || time.Now().After(deadline) {
			break
		}
		time.Sleep(time.Millisecond)
	}
	pool.stop()
	if overlapped.Load() {
		t.Fatal("two synchronizations of one sandbox overlapped")
	}
	if len(seen) != 2 || seen[1] != coalescedUpdates {
		t.Fatalf("synchronized revisions %v, want the first and then only the newest", seen)
	}
}

func TestWorkersRetryAndRetire(t *testing.T) {
	var attempts atomic.Int32
	done := make(chan struct{})
	pool := newWorkerPool(t.Context(), func(ctx context.Context, item work) outcome {
		if attempts.Add(1) == 1 {
			return outcomeRetry
		}
		close(done)
		return outcomeRemoved
	})
	pool.update(work{sandboxID: testSandboxID})
	select {
	case <-done:
	case <-time.After(workerDeadline):
		t.Fatal("a failed synchronization was not retried")
	}
	deadline := time.Now().Add(workerDeadline)
	for {
		pool.mu.Lock()
		retired := len(pool.workers) == 0
		pool.mu.Unlock()
		if retired {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the worker of a removed sandbox was not retired")
		}
		time.Sleep(time.Millisecond)
	}
	pool.stop()
}
