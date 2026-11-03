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
	"os"
	"os/exec"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

const (
	recoveredInstanceID   = "recovered-instance"
	meteredBeforeRestart  = time.Minute
	observedBeforeRestart = 20 * time.Second
	runtimeDirectoryMode  = 0o755
)

func startStandInVMM(t *testing.T, paths layout.Paths) int {
	t.Helper()
	command := exec.CommandContext(t.Context(), "sleep", "30")
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	wait := make(chan error, 1)
	go func() { wait <- command.Wait() }()
	t.Cleanup(func() {
		if killErr := command.Process.Kill(); killErr != nil && !errors.Is(killErr, os.ErrProcessDone) {
			t.Errorf("kill stand-in VMM: %v", killErr)
		}
		var exitErr *exec.ExitError
		if waitErr := <-wait; waitErr != nil && !errors.As(waitErr, &exitErr) {
			t.Errorf("wait for stand-in VMM: %v", waitErr)
		}
	})
	if err := os.MkdirAll(paths.InstanceDir(recoveredInstanceID), runtimeDirectoryMode); err != nil {
		t.Fatal(err)
	}
	process, err := hypervisor.IdentifyProcess(command.Process.Pid)
	if err != nil {
		t.Fatal(err)
	}
	if err := hypervisor.WritePID(paths.InstancePID(recoveredInstanceID), process); err != nil {
		t.Fatal(err)
	}
	return command.Process.Pid
}

func meterOpenedBefore(now time.Time) state.RunningMeter {
	since := now.Add(-meteredBeforeRestart)
	observedAt := since.Add(observedBeforeRestart)
	return state.RunningMeter{Since: &since, ObservedAt: &observedAt}
}

func TestRecoveredRunningInstanceKeepsMeteringAcrossTheRestart(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths}
	recoveredAt := time.Now().UTC()
	metadata := state.InstanceMetadata{
		ID: recoveredInstanceID, PID: startStandInVMM(t, paths), State: types.RuntimeStateStarted,
		RunningMeter: meterOpenedBefore(recoveredAt),
	}
	reconciled, err := backend.reconcileInstanceMetadata(context.Background(), metadata)
	if err != nil {
		t.Fatal(err)
	}
	if reconciled.State != types.RuntimeStateStarted || reconciled.RunningMeter.Since == nil {
		t.Fatalf("recovered instance = %s with meter %+v, want an open run", reconciled.State, reconciled.RunningMeter)
	}
	if got := runningMillis(reconciled.RunningMeter); got < uint64(meteredBeforeRestart.Milliseconds()) {
		t.Fatalf("running millis = %d, want the time the node process was down counted", got)
	}
}

func TestRecoveredRunningInstanceWithoutAnOpenRunStartsMeteringAtRecovery(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths}
	before := time.Now().UTC()
	metadata := state.InstanceMetadata{ID: recoveredInstanceID, PID: startStandInVMM(t, paths), State: types.RuntimeStateStarted}
	reconciled, err := backend.reconcileInstanceMetadata(context.Background(), metadata)
	if err != nil {
		t.Fatal(err)
	}
	if since := reconciled.RunningMeter.Since; since == nil || since.Before(before) {
		t.Fatalf("recovered meter = %+v, want a run opened at recovery", reconciled.RunningMeter)
	}
}

func TestRecoveredPausedInstanceStaysPaused(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths}
	metadata := state.InstanceMetadata{
		ID: recoveredInstanceID, PID: startStandInVMM(t, paths), State: types.RuntimeStatePaused,
		RunningMeter: state.RunningMeter{Millis: uint64(meteredBeforeRestart.Milliseconds())},
	}
	reconciled, err := backend.reconcileInstanceMetadata(context.Background(), metadata)
	if err != nil {
		t.Fatal(err)
	}
	if reconciled.State != types.RuntimeStatePaused || reconciled.RunningMeter != metadata.RunningMeter {
		t.Fatalf("recovered paused instance = %s with meter %+v", reconciled.State, reconciled.RunningMeter)
	}
}

func TestInstanceThatDiedWhileTheNodeWasDownIsNotCreditedAfterItsDeath(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths}
	metadata := state.InstanceMetadata{
		ID: recoveredInstanceID, State: types.RuntimeStateStarted,
		RunningMeter: meterOpenedBefore(time.Now().UTC()),
	}
	reconciled, err := backend.reconcileInstanceMetadata(context.Background(), metadata)
	if err != nil {
		t.Fatal(err)
	}
	want := state.RunningMeter{Millis: uint64(observedBeforeRestart.Milliseconds())}
	if reconciled.State != types.RuntimeStateStopped || reconciled.RunningMeter != want {
		t.Fatalf("dead instance = %s with meter %+v, want %+v", reconciled.State, reconciled.RunningMeter, want)
	}
}
