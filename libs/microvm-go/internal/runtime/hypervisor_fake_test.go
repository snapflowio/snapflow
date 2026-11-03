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
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/admission"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/volumes"
)

const fakeVMMLifetime = "60"

type fakeHypervisor struct {
	mu           sync.Mutex
	capabilities hypervisor.Capabilities
	calls        []string
	state        hypervisor.VMState
	restoreErr   error
}

func (fake *fakeHypervisor) record(call string) {
	fake.mu.Lock()
	fake.calls = append(fake.calls, call)
	fake.mu.Unlock()
}

func (fake *fakeHypervisor) recorded() []string {
	fake.mu.Lock()
	defer fake.mu.Unlock()
	return slices.Clone(fake.calls)
}

func (fake *fakeHypervisor) Capabilities() hypervisor.Capabilities { return fake.capabilities }

func (fake *fakeHypervisor) Start(context.Context, hypervisor.VM) (hypervisor.Process, error) {
	fake.record("start")
	return hypervisor.Process{}, errors.New("fake hypervisor does not boot guests")
}

func (fake *fakeHypervisor) Restore(context.Context, hypervisor.VM, string) (hypervisor.Process, error) {
	fake.record("restore")
	return hypervisor.Process{}, fake.restoreErr
}

func (fake *fakeHypervisor) Pause(context.Context, string) error {
	fake.record("pause")
	return nil
}

func (fake *fakeHypervisor) Resume(context.Context, string) error {
	fake.record("resume")
	return nil
}

func (fake *fakeHypervisor) Info(context.Context, string) (hypervisor.VMInfo, error) {
	fake.record("info")
	return hypervisor.VMInfo{State: fake.state}, nil
}

func (fake *fakeHypervisor) Snapshot(context.Context, string, string) error {
	fake.record("snapshot")
	return nil
}

func (fake *fakeHypervisor) Shutdown(context.Context, string) error {
	fake.record("shutdown")
	return nil
}

func (fake *fakeHypervisor) PrepareFork(context.Context, hypervisor.ForkPrepareRequest) (hypervisor.ForkPrepareResult, error) {
	fake.record("prepare-fork")
	return hypervisor.ForkPrepareResult{Prepared: true}, nil
}

func newFakeBackend(t *testing.T, fake *fakeHypervisor) *Backend {
	t.Helper()
	paths := layout.NewPaths(t.TempDir())
	controller, err := admission.NewController(admission.Resources{CPUVCPUs: 8, MemoryGiB: 16, DiskGiB: 100, NetworkSlots: 8})
	if err != nil {
		t.Fatal(err)
	}
	backends := map[hypervisor.Hypervisor]HypervisorBackend{hypervisor.HypervisorCloudHypervisor: fake}
	return &Backend{
		paths:              paths,
		hypervisors:        backends,
		restoreSlots:       restoreSlots(backends),
		admission:          controller,
		volumes:            volumes.NewManager(paths),
		supportDiskSamples: make(chan struct{}, 1),
		prepareSnapshot: func(_, path string) error {
			return os.MkdirAll(path, instanceVMMDirectoryMode)
		},
	}
}

func startFakeVMM(t *testing.T, backend *Backend, instanceID string) hypervisor.Process {
	t.Helper()
	command := exec.CommandContext(t.Context(), "sleep", fakeVMMLifetime)
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	exited := make(chan struct{})
	go func() {
		if err := command.Wait(); err != nil {
			t.Logf("fake VMM exited: %v", err)
		}
		close(exited)
	}()
	t.Cleanup(func() {
		if err := command.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
			t.Error(err)
		}
		<-exited
	})
	process, err := hypervisor.IdentifyProcess(command.Process.Pid)
	if err != nil {
		t.Fatal(err)
	}
	if err := hypervisor.WritePID(backend.paths.InstancePID(instanceID), process); err != nil {
		t.Fatal(err)
	}
	return process
}

func runningFakeInstance(t *testing.T, backend *Backend, instanceID string) state.InstanceMetadata {
	t.Helper()
	metadata := state.InstanceMetadata{
		ID:             instanceID,
		Hypervisor:     hypervisor.HypervisorCloudHypervisor,
		CPUQuota:       2,
		MemoryQuota:    4,
		StorageQuota:   10,
		State:          types.RuntimeStateStarted,
		NetworkEnabled: true,
		Network:        testAllocation(instanceID, 7),
	}
	if err := backend.writeInstance(metadata); err != nil {
		t.Fatal(err)
	}
	return metadata
}

func TestForcedStopTerminatesTheVMMAndKeepsTheNetworkSlot(t *testing.T) {
	fake := &fakeHypervisor{capabilities: hypervisor.Capabilities{Snapshots: true}}
	backend := newFakeBackend(t, fake)
	metadata := runningFakeInstance(t, backend, "stop-forced")
	process := startFakeVMM(t, backend, metadata.ID)
	if err := os.MkdirAll(backend.paths.InstanceLatestSnapshot(metadata.ID), 0o755); err != nil {
		t.Fatal(err)
	}

	if err := backend.stopLockedWithOptions(context.Background(), metadata.ID, types.StopOptions{Force: true, GracePeriod: time.Second}); err != nil {
		t.Fatal(err)
	}
	backend.background.Wait()

	if process.Running() {
		t.Fatal("forced stop left the VMM running")
	}
	stopped, err := state.ReadInstanceMetadata(backend.paths, metadata.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stopped.State != types.RuntimeStateStopped || stopped.PID != 0 {
		t.Fatalf("stopped instance = state %s pid %d", stopped.State, stopped.PID)
	}
	if stopped.Network == nil || *stopped.Network != *metadata.Network {
		t.Fatalf("stop released the network slot: %+v", stopped)
	}
	assertStopArtifactsRemoved(t, backend, metadata.ID)
	if got := fake.recorded(); len(got) != 0 {
		t.Fatalf("forced stop called the hypervisor API: %v", got)
	}
	committed := backend.admission.Committed()
	if committed.CPUVCPUs != 0 || committed.MemoryGiB != 0 || committed.NetworkSlots != 1 || committed.DiskGiB != 10 {
		t.Fatalf("ledger after stop = %+v, want disk and network only", committed)
	}
}

func TestStopOfAnExitedVMMShutsDownWithoutSignalling(t *testing.T) {
	fake := &fakeHypervisor{capabilities: hypervisor.Capabilities{Snapshots: true}}
	backend := newFakeBackend(t, fake)
	metadata := runningFakeInstance(t, backend, "stop-exited")

	if err := backend.stopLockedWithOptions(context.Background(), metadata.ID, types.StopOptions{}); err != nil {
		t.Fatal(err)
	}
	if got := fake.recorded(); !slices.Equal(got, []string{"shutdown"}) {
		t.Fatalf("hypervisor calls = %v, want only the graceful shutdown", got)
	}
	stopped, err := state.ReadInstanceMetadata(backend.paths, metadata.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stopped.State != types.RuntimeStateStopped {
		t.Fatalf("state = %s, want stopped", stopped.State)
	}
}

func TestReconcileRemovesRetiredSnapshots(t *testing.T) {
	backend := newFakeBackend(t, &fakeHypervisor{})
	retired := backend.paths.InstanceDiscardedSnapshot("instance", "1")
	if err := os.MkdirAll(filepath.Join(retired, "memory"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(backend.paths.InstanceLatestSnapshot("instance"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := backend.removeDiscardedSnapshots("instance"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(retired); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("retired snapshot survived: %v", err)
	}
	if _, err := os.Stat(backend.paths.InstanceLatestSnapshot("instance")); err != nil {
		t.Fatalf("live snapshot was removed: %v", err)
	}
}

func TestVMControlDispatchesToTheInstanceHypervisor(t *testing.T) {
	fake := &fakeHypervisor{capabilities: hypervisor.Capabilities{Snapshots: true}, state: hypervisor.VMStatePaused}
	backend := newFakeBackend(t, fake)
	metadata := state.InstanceMetadata{ID: "dispatch", Hypervisor: hypervisor.HypervisorCloudHypervisor, SocketPath: "/nonexistent"}
	ctx := context.Background()
	if err := backend.pauseVM(ctx, metadata); err != nil {
		t.Fatal(err)
	}
	paused, err := backend.vmIsPaused(ctx, metadata)
	if err != nil || !paused {
		t.Fatalf("vmIsPaused() = %t, %v", paused, err)
	}
	if err := backend.resumeVM(ctx, metadata); err != nil {
		t.Fatal(err)
	}
	if err := backend.snapshotVM(ctx, metadata, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	if got, want := fake.recorded(), []string{"pause", "info", "resume", "snapshot"}; !slices.Equal(got, want) {
		t.Fatalf("hypervisor calls = %v, want %v", got, want)
	}
	if err := backend.pauseVM(ctx, state.InstanceMetadata{Hypervisor: hypervisor.HypervisorFirecracker}); !errors.Is(err, hypervisor.ErrInvalidHypervisor) {
		t.Fatalf("pauseVM() for an unconfigured hypervisor error = %v", err)
	}
}

func TestRestoreRequiresSnapshotCapabilityAndClassifiesFailures(t *testing.T) {
	unavailable := newFakeBackend(t, &fakeHypervisor{})
	spec := hypervisor.VM{ID: "restore", Hypervisor: hypervisor.HypervisorCloudHypervisor}
	_, err := unavailable.restoreVM(context.Background(), spec, t.TempDir())
	var coded *mvmerrors.Error
	if !errors.As(err, &coded) || coded.HTTPStatusCode() != http.StatusNotImplemented {
		t.Fatalf("restoreVM() without snapshot support error = %v", err)
	}

	launchFailure := errors.New("vmm exited")
	fake := &fakeHypervisor{capabilities: hypervisor.Capabilities{Snapshots: true, RestoreConcurrency: 1}, restoreErr: launchFailure}
	backend := newFakeBackend(t, fake)
	_, err = backend.restoreVM(context.Background(), spec, t.TempDir())
	var failure *restoreFailure
	if !errors.As(err, &failure) || !errors.Is(err, launchFailure) {
		t.Fatalf("restoreVM() error = %v, want a classified restore failure", err)
	}
	if got := fake.recorded(); !slices.Equal(got, []string{"restore"}) {
		t.Fatalf("hypervisor calls = %v", got)
	}
}

func TestAttachInstanceNetworkKeepsAnExistingSlot(t *testing.T) {
	backend := newFakeBackend(t, &fakeHypervisor{})
	for name, metadata := range map[string]state.InstanceMetadata{
		"disabled": {ID: "disabled"},
		"attached": {ID: "attached", NetworkEnabled: true, Network: testAllocation("attached", 9)},
	} {
		before := metadata
		allocated, err := backend.attachInstanceNetwork(context.Background(), &metadata)
		if err != nil || allocated {
			t.Fatalf("%s: attachInstanceNetwork() = %t, %v; want no allocation", name, allocated, err)
		}
		if metadata.Network != before.Network {
			t.Fatalf("%s: network identity changed from %+v to %+v", name, before, metadata)
		}
	}
}

func assertStopArtifactsRemoved(t *testing.T, backend *Backend, instanceID string) {
	t.Helper()
	entries, err := os.ReadDir(backend.paths.InstanceSnapshotsDir(instanceID))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("stop left %d snapshot entries behind", len(entries))
	}
	if _, err := os.Stat(backend.paths.InstancePID(instanceID)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("stop left the PID record: %v", err)
	}
}
