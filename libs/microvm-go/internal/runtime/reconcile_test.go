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

	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/network"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/volumes"
)

const (
	healthyReconcileInstanceID = "healthy"
	corruptReconcileInstanceID = "corrupt"
)

func TestReconcileQuarantinesUnreadableInstanceAndRecoversTheRest(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	controller, err := admission.NewController(admission.Resources{CPUVCPUs: 8, MemoryGiB: 16, DiskGiB: 64, NetworkSlots: 8})
	if err != nil {
		t.Fatal(err)
	}
	disabledNetwork := network.DefaultConfig()
	disabledNetwork.Enabled = false
	backend := &Backend{
		paths:              paths,
		admission:          controller,
		volumes:            volumes.NewManager(paths),
		networks:           network.NewManager(disabledNetwork),
		events:             lifecycle.NewEventBus(0),
		supportDiskSamples: make(chan struct{}, 1),
	}
	healthy := state.InstanceMetadata{ID: healthyReconcileInstanceID, State: types.RuntimeStateStarted}
	if err := os.MkdirAll(paths.InstanceDir(healthy.ID), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := state.WriteInstanceMetadata(paths, healthy); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(paths.InstanceDir(corruptReconcileInstanceID), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.InstanceMetadata(corruptReconcileInstanceID), []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}

	report, err := backend.reconcile(context.Background())
	if err != nil {
		t.Fatalf("reconcile failed for the whole runtime: %v", err)
	}
	if _, failed := report.Failed[corruptReconcileInstanceID]; !failed || len(report.Failed) != 1 {
		t.Fatalf("failed instances = %v, want only %s", report.Failed, corruptReconcileInstanceID)
	}
	reconciled, err := state.ReadInstanceMetadata(paths, healthyReconcileInstanceID)
	if err != nil {
		t.Fatal(err)
	}
	if reconciled.State != types.RuntimeStateStopped {
		t.Fatalf("healthy instance state = %s, want %s", reconciled.State, types.RuntimeStateStopped)
	}
	if _, err := os.Stat(paths.InstanceMetadata(corruptReconcileInstanceID)); err != nil {
		t.Fatalf("quarantined instance state was removed: %v", err)
	}
}

func TestReconcileFailsClosedForUncommittedRestoreIdentity(t *testing.T) {
	command := exec.CommandContext(t.Context(), "sleep", "30")
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	wait := make(chan error, 1)
	go func() { wait <- command.Wait() }()
	t.Cleanup(func() {
		if killErr := command.Process.Kill(); killErr != nil && !errors.Is(killErr, os.ErrProcessDone) {
			t.Errorf("kill test process: %v", killErr)
		}
		if waitErr := <-wait; waitErr != nil {
			var exitErr *exec.ExitError
			if !errors.As(waitErr, &exitErr) {
				t.Errorf("wait for test process: %v", waitErr)
			}
		}
	})

	paths := layout.NewPaths(t.TempDir())
	backend := &Backend{paths: paths}
	metadata := state.InstanceMetadata{
		ID:                       "restore-pending",
		PID:                      command.Process.Pid,
		State:                    types.RuntimeStateRestoring,
		SnapshotIdentityQuiesced: true,
		RestoreIdentityPending:   true,
		SnapshotControlAuthToken: "snapshot-control-token",
		RestoreControlAuthToken:  "snapshot-control-token",
	}
	if err := os.MkdirAll(paths.InstanceLatestSnapshot(metadata.ID), 0o755); err != nil {
		t.Fatal(err)
	}

	reconciled, err := backend.reconcileInstanceMetadata(context.Background(), metadata)
	if err != nil {
		t.Fatal(err)
	}
	if reconciled.State != types.RuntimeStateStandby {
		t.Fatalf("reconciled state = %s, want %s", reconciled.State, types.RuntimeStateStandby)
	}
	if reconciled.PID != 0 {
		t.Fatalf("reconciled PID = %d, want 0", reconciled.PID)
	}
	if !reconciled.RestoreIdentityPending {
		t.Fatal("restore identity intent was cleared before a successful retry")
	}
}
