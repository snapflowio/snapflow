// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package runtime

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

func TestLockInstanceMutationRechecksLinkedPeerAfterWaitingForTarget(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	coordinator := lifecycle.NewCoordinator()
	backend := &Backend{paths: paths, lifecycle: coordinator}

	creating, err := coordinator.Lock(context.Background(), "target")
	if err != nil {
		t.Fatal(err)
	}

	result := make(chan struct {
		guard *lifecycle.Guard
		err   error
	}, 1)
	go func() {
		guard, lockErr := backend.lockInstanceMutation(context.Background(), "target")
		result <- struct {
			guard *lifecycle.Guard
			err   error
		}{guard: guard, err: lockErr}
	}()

	if err := state.WriteInstanceMetadata(paths, state.InstanceMetadata{
		ID:         "target",
		LinkedPeer: &state.LinkedPeerMetadata{InstanceID: "peer"},
	}); err != nil {
		creating.Release()
		t.Fatal(err)
	}
	creating.Release()

	locked := <-result
	if locked.err != nil {
		t.Fatal(locked.err)
	}
	defer locked.guard.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if _, err := coordinator.Lock(ctx, "peer"); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("peer lock error = %v, want deadline exceeded", err)
	}
}

func TestStopIsIdempotentAfterDurableLocalSuccess(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths}
	metadata := state.InstanceMetadata{
		ID:    "already-stopped",
		State: types.RuntimeStateStopped,
	}
	if err := state.WriteInstanceMetadata(paths, metadata); err != nil {
		t.Fatal(err)
	}

	if err := backend.stopLockedWithOptions(context.Background(), metadata.ID, types.StopOptions{}); err != nil {
		t.Fatalf("replayed stop failed: %v", err)
	}
}
