// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"errors"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const (
	testDrainTimeout      = time.Second
	testDrainPollInterval = time.Millisecond
)

type runFunc func(context.Context) error

func (run runFunc) Run(ctx context.Context) error {
	return run(ctx)
}

func untilCancelled(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func noDrain() drainPlan {
	return drainPlan{
		begin:        func(context.Context) {},
		complete:     func() bool { return true },
		timeout:      testDrainTimeout,
		pollInterval: testDrainPollInterval,
	}
}

func testRegistry(entries map[string]runFunc) registry {
	var components registry
	for name, run := range entries {
		components.register(name, run)
	}
	return components
}

func TestFailingComponentStopsTheGroupWithItsName(t *testing.T) {
	t.Parallel()
	failure := errors.New("listener failed")
	err := supervise(context.Background(), testRegistry(map[string]runFunc{
		"waiter":   untilCancelled,
		"listener": func(context.Context) error { return failure },
	}), noDrain())
	if !errors.Is(err, failure) || !strings.Contains(err.Error(), "listener") {
		t.Fatalf("group error = %v, want the named listener failure", err)
	}
}

func TestComponentStoppingWithoutErrorIsUnexpected(t *testing.T) {
	t.Parallel()
	err := supervise(context.Background(), testRegistry(map[string]runFunc{
		"waiter":  untilCancelled,
		"metrics": func(context.Context) error { return nil },
	}), noDrain())
	if err == nil || !strings.Contains(err.Error(), "metrics stopped unexpectedly") {
		t.Fatalf("group error = %v, want an unexpected stop", err)
	}
}

func TestParentShutdownDrainsBeforeCancellingComponents(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(context.Background())
	var draining atomic.Bool
	var cancelledBeforeDrain atomic.Bool
	drain := drainPlan{
		begin:        func(context.Context) { draining.Store(true) },
		complete:     func() bool { return draining.Load() },
		timeout:      testDrainTimeout,
		pollInterval: testDrainPollInterval,
	}
	started := make(chan struct{})
	component := func(componentContext context.Context) error {
		close(started)
		<-componentContext.Done()
		if !draining.Load() {
			cancelledBeforeDrain.Store(true)
		}
		return componentContext.Err()
	}
	result := make(chan error, 1)
	go func() {
		result <- supervise(ctx, testRegistry(map[string]runFunc{"ingress": component}), drain)
	}()
	<-started
	cancel()
	if err := <-result; err != nil {
		t.Fatalf("clean shutdown returned %v", err)
	}
	if cancelledBeforeDrain.Load() {
		t.Fatal("component was cancelled before the group began draining")
	}
}
