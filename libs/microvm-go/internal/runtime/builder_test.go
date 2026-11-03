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
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/snapflowio/microvm-go/builds"
	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/configdrive"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/template"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

func TestBuilderConfigDriveRunsTheDaemonOnItsStateDiskWithoutCredentials(t *testing.T) {
	metadata := state.InstanceMetadata{ID: "builder", ConfigDisk: filepath.Join(t.TempDir(), "config.raw")}
	daemonConfig := []byte("[worker.oci]\ngc = true\n")
	spec := builds.BuilderSpec{
		Command:    []string{"/usr/bin/buildkitd", "--addr", "tcp://127.0.0.1:1234"},
		StateMount: "/var/lib/buildkit",
		ConfigFile: builds.BuilderFile{Path: "/etc/buildkit/buildkitd.toml", Content: daemonConfig},
	}
	backend := &Backend{}
	if err := backend.writeBuilderConfigDrive(metadata, map[string]string{"DOCKER_CONFIG": "/image/docker"}, spec); err != nil {
		t.Fatal(err)
	}
	drive, err := os.Open(metadata.ConfigDisk)
	if err != nil {
		t.Fatal(err)
	}
	defer drive.Close()
	cfg, injected, err := configdrive.Read(drive)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(cfg.Entrypoint, spec.Command) || len(cfg.Cmd) != 0 {
		t.Fatalf("builder command = %v %v, want %v", cfg.Entrypoint, cfg.Cmd, spec.Command)
	}
	if len(cfg.VolumeMounts) != 1 || cfg.VolumeMounts[0].Device != builderStateDevice || cfg.VolumeMounts[0].Path != spec.StateMount {
		t.Fatalf("builder state mount = %+v", cfg.VolumeMounts)
	}
	if cfg.InjectedFilePath != spec.ConfigFile.Path || string(injected) != string(daemonConfig) {
		t.Fatalf("builder daemon configuration = %s at %s", injected, cfg.InjectedFilePath)
	}
	if strings.Contains(string(injected), "auths") || cfg.Env["DOCKER_CONFIG"] != "/image/docker" {
		t.Fatal("builder config drive carries registry credentials")
	}
}

func newBuilderTestBackend(t *testing.T, diskGiB int64) *Backend {
	t.Helper()
	controller, err := admission.NewController(admission.Resources{CPUVCPUs: 16, MemoryGiB: 64, DiskGiB: diskGiB, NetworkSlots: 8})
	if err != nil {
		t.Fatal(err)
	}
	return &Backend{
		paths:              layout.NewPaths(t.TempDir()),
		admission:          controller,
		supportDiskSamples: make(chan struct{}, 1),
		buildDiskHolds:     make(map[string]int),
	}
}

func allocatedResourcesForTest(t *testing.T, backend *Backend) types.AllocatedResources {
	t.Helper()
	allocated, err := backend.AllocatedResources(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	return allocated
}

func TestBuilderReservesItsDiskQuotaOnlyWhileABuildRuns(t *testing.T) {
	backend := newBuilderTestBackend(t, 500)
	builder := state.InstanceMetadata{
		ID:                  "warm-builder",
		State:               types.RuntimeStateStarted,
		CPUQuota:            2,
		MemoryQuota:         4,
		StorageQuota:        20,
		AdditionalDiskQuota: 20,
		Labels:              map[string]string{internalBuilderLabel: internalBuilderLabelValue},
	}
	if err := backend.writeInstance(builder); err != nil {
		t.Fatal(err)
	}
	if idle := allocatedResourcesForTest(t, backend); idle.CPUVCPUs != 2 || idle.MemoryGiB != 4 || idle.DiskGiB != 0 {
		t.Fatalf("idle warm builder allocation = %+v, want 2 vCPU, 4 GiB memory and no disk quota", idle)
	}
	for range 2 {
		if err := backend.ReserveBuildDisk(t.Context(), builder.ID); err != nil {
			t.Fatal(err)
		}
	}
	if building := allocatedResourcesForTest(t, backend); building.DiskGiB != 40 {
		t.Fatalf("builder disk during two overlapping builds = %d GiB, want the 40 GiB quota once", building.DiskGiB)
	}
	backend.ReleaseBuildDisk(builder.ID)
	if building := allocatedResourcesForTest(t, backend); building.DiskGiB != 40 {
		t.Fatalf("builder disk while one build still runs = %d GiB, want 40", building.DiskGiB)
	}
	backend.ReleaseBuildDisk(builder.ID)
	if idle := allocatedResourcesForTest(t, backend); idle.DiskGiB != 0 {
		t.Fatalf("builder disk after its builds finished = %d GiB, want 0", idle.DiskGiB)
	}
	if err := backend.removeInstanceStateDirectories(builder.ID); err != nil {
		t.Fatal(err)
	}
	if stopped := allocatedResourcesForTest(t, backend); stopped != (types.AllocatedResources{}) {
		t.Fatalf("stopped builder still holds %+v", stopped)
	}
}

func TestBuildIsRejectedWhenItsDiskHeadroomDoesNotFit(t *testing.T) {
	backend := newBuilderTestBackend(t, 30)
	builder := state.InstanceMetadata{
		ID:                  "busy-machine-builder",
		State:               types.RuntimeStateStarted,
		StorageQuota:        20,
		AdditionalDiskQuota: 20,
		Labels:              map[string]string{internalBuilderLabel: internalBuilderLabelValue},
	}
	if err := backend.writeInstance(builder); err != nil {
		t.Fatal(err)
	}
	backend.templates = template.New(template.Config{Paths: backend.paths}, removingSeeds{paths: backend.paths})

	if err := backend.ReserveBuildDisk(t.Context(), builder.ID); err == nil {
		t.Fatal("a build reserved 40 GiB of headroom on a 30 GiB machine")
	}
	if held := backend.buildDiskHolds[builder.ID]; held != 0 {
		t.Fatalf("a rejected build left %d holds", held)
	}
}
