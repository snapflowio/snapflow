// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

const testTimeout = 5 * time.Second

func blockUntilDone(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func waitResult(t *testing.T, group *stage) error {
	t.Helper()
	result := make(chan error, 1)
	go func() { result <- group.Wait() }()
	select {
	case err := <-result:
		return err
	case <-time.After(testTimeout):
		t.Fatal("group did not finish")
		return nil
	}
}

func TestStopReturnsNilAfterJoiningActors(t *testing.T) {
	group := newStage(context.WithCancel(context.Background()))
	var stopped atomic.Int32
	for range 3 {
		group.Go("blocking", func(ctx context.Context) error {
			<-ctx.Done()
			stopped.Add(1)
			return ctx.Err()
		})
	}
	group.Stop()
	if err := waitResult(t, group); err != nil {
		t.Fatalf("Wait() = %v, want nil", err)
	}
	if got := stopped.Load(); got != 3 {
		t.Fatalf("joined %d actors, want 3", got)
	}
}

func TestActorFailureStopsGroupAndIsReported(t *testing.T) {
	group := newStage(context.WithCancel(context.Background()))
	failure := errors.New("boom")
	group.Go("waiter", blockUntilDone)
	group.Go("failing", func(context.Context) error { return failure })
	select {
	case <-group.Done():
	case <-time.After(testTimeout):
		t.Fatal("group did not stop after an actor failed")
	}
	err := waitResult(t, group)
	var exit *componentExitError
	if !errors.As(err, &exit) || exit.Component != "failing" || !errors.Is(err, failure) {
		t.Fatalf("Wait() = %v, want failing actor exit", err)
	}
}

func TestNilReturnWhileRunningIsUnexpected(t *testing.T) {
	group := newStage(context.WithCancel(context.Background()))
	group.Go("waiter", blockUntilDone)
	group.Go("early", func(context.Context) error { return nil })
	err := waitResult(t, group)
	var exit *componentExitError
	if !errors.As(err, &exit) || exit.Component != "early" || !errors.Is(err, errUnexpectedExit) {
		t.Fatalf("Wait() = %v, want unexpected exit of early", err)
	}
}

func TestOnlyFirstExitIsReported(t *testing.T) {
	group := newStage(context.WithCancel(context.Background()))
	release := make(chan struct{})
	group.Go("first", func(context.Context) error {
		defer close(release)
		return errors.New("first failure")
	})
	group.Go("second", func(ctx context.Context) error {
		<-release
		<-ctx.Done()
		return errors.New("second failure")
	})
	err := waitResult(t, group)
	var exit *componentExitError
	if !errors.As(err, &exit) || exit.Component != "first" {
		t.Fatalf("Wait() = %v, want first actor exit", err)
	}
}

func TestParentCancellationStopsGroup(t *testing.T) {
	parent, cancel := context.WithCancel(context.Background())
	group := newStage(context.WithCancel(parent))
	group.Go("waiter", blockUntilDone)
	cancel()
	if err := waitResult(t, group); err != nil {
		t.Fatalf("Wait() = %v, want nil after parent cancellation", err)
	}
}

func TestNestedGroupStopsWithParentGroup(t *testing.T) {
	parentContext, stopParent := context.WithCancel(context.Background())
	parent := newStage(parentContext, stopParent)
	child := newStage(context.WithCancel(parentContext))
	child.Go("child", blockUntilDone)
	parent.Go("failing", func(context.Context) error { return errors.New("parent failure") })
	if err := waitResult(t, child); err != nil {
		t.Fatalf("child Wait() = %v, want nil when the parent stops it", err)
	}
	if err := waitResult(t, parent); err == nil {
		t.Fatal("parent Wait() = nil, want the failing actor exit")
	}
}
