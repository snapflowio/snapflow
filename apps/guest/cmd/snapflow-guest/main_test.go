// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package main

import (
	"context"
	"errors"
	"testing"
)

var errComponentFailed = errors.New("bind failed")

func waitForCancel(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func TestSuperviseStopsEveryComponentWhenOneFails(t *testing.T) {
	stopped := make(chan struct{})
	err := supervise(context.Background(), []component{
		{name: "healthy", run: func(ctx context.Context) error {
			defer close(stopped)
			return waitForCancel(ctx)
		}},
		{name: "broken", run: func(context.Context) error { return errComponentFailed }},
	})
	if !errors.Is(err, errComponentFailed) {
		t.Fatalf("supervise() = %v, want the component failure", err)
	}
	<-stopped
}

func TestSuperviseReportsComponentsThatStopUnexpectedly(t *testing.T) {
	err := supervise(context.Background(), []component{
		{name: "healthy", run: waitForCancel},
		{name: "quitter", run: func(context.Context) error { return nil }},
	})
	if err == nil {
		t.Fatal("supervise() accepted a component that stopped on its own")
	}
}

func TestSuperviseReturnsCleanlyOnShutdown(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := supervise(ctx, []component{{name: "healthy", run: waitForCancel}}); err != nil {
		t.Fatalf("supervise() after shutdown = %v, want nil", err)
	}
}
