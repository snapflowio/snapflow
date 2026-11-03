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

package lifecycle

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestCoordinatorSerializesSameKey(t *testing.T) {
	coordinator := NewCoordinator()
	first, err := coordinator.Lock(context.Background(), "instance-a")
	if err != nil {
		t.Fatal(err)
	}
	defer first.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if _, err := coordinator.Lock(ctx, "instance-a"); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Lock() error = %v, want deadline exceeded", err)
	}
}

func TestCoordinatorLockManyUsesStableOrder(t *testing.T) {
	coordinator := NewCoordinator()
	first, err := coordinator.LockMany(context.Background(), "source", "target")
	if err != nil {
		t.Fatal(err)
	}

	done := make(chan error, 1)
	go func() {
		guard, err := coordinator.LockMany(context.Background(), "target", "source")
		if err == nil {
			guard.Release()
		}
		done <- err
	}()

	first.Release()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("LockMany deadlocked")
	}
}

func TestCoordinatorAllowsConcurrentReadersAndBlocksWriter(t *testing.T) {
	coordinator := NewCoordinator()
	first, err := coordinator.ReadLock(context.Background(), "instance")
	if err != nil {
		t.Fatal(err)
	}
	defer first.Release()
	second, err := coordinator.ReadLock(context.Background(), "instance")
	if err != nil {
		t.Fatal(err)
	}
	defer second.Release()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if _, err := coordinator.Lock(ctx, "instance"); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Lock() error = %v, want context deadline exceeded", err)
	}
}

func TestGuardReleaseIsIdempotent(t *testing.T) {
	coordinator := NewCoordinator()
	guard, err := coordinator.Lock(context.Background(), "instance-a")
	if err != nil {
		t.Fatal(err)
	}
	guard.Release()
	guard.Release()

	next, err := coordinator.Lock(context.Background(), "instance-a")
	if err != nil {
		t.Fatal(err)
	}
	next.Release()
}
