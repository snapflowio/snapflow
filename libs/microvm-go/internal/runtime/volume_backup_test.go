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
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/ext4"
	"github.com/snapflowio/microvm-go/internal/admission"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/transferpolicy"
	"github.com/snapflowio/microvm-go/internal/volumeartifact"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/microvm-go/volumes"
)

func TestVerifyVolumeBackupDoesNotRequireLocalVolume(t *testing.T) {
	workDir := t.TempDir()
	rawPath := filepath.Join(workDir, "volume.raw")
	const rawSize = int64(64 * 1024 * 1024)
	if err := os.WriteFile(rawPath, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Truncate(rawPath, rawSize); err != nil {
		t.Fatal(err)
	}
	mkfs, err := ext4.MkfsPath()
	if err != nil {
		t.Fatal(err)
	}
	if output, err := exec.CommandContext(t.Context(), mkfs, "-F", "-q", rawPath).CombinedOutput(); err != nil {
		t.Fatalf("format test volume: %v: %s", err, output)
	}
	if err := os.Chmod(rawPath, 0o600); err != nil {
		t.Fatal(err)
	}
	key := make([]byte, volumeartifact.DataKeyBytes)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	dataKey := base64.StdEncoding.EncodeToString(key)
	volumeID := uuid.NewString()
	artifactID := uuid.NewString()
	source, err := os.Open(rawPath)
	if err != nil {
		t.Fatal(err)
	}
	defer source.Close()
	var pack bytes.Buffer
	backup, err := volumeartifact.Backup(t.Context(), source, &pack, volumeartifact.BackupRequest{
		VolumeID: volumeID, ArtifactID: artifactID, DataKey: dataKey,
	})
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := volumeartifact.SealManifest(backup.Manifest, dataKey)
	if err != nil {
		t.Fatal(err)
	}
	objects := map[string][]byte{"/manifest": manifest, "/pack": pack.Bytes()}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		object, exists := objects[request.URL.Path]
		if request.Method != http.MethodGet || !exists {
			t.Errorf("unexpected backup object request %s %s", request.Method, request.URL.Path)
			http.NotFound(response, request)
			return
		}
		http.ServeContent(response, request, "", time.Time{}, bytes.NewReader(object))
	}))
	defer server.Close()
	transfers, err := transferpolicy.New([]string{server.URL})
	if err != nil {
		t.Fatal(err)
	}

	controller, err := admission.NewController(
		admission.Resources{CPUVCPUs: 1, MemoryGiB: 1, DiskGiB: 2},
	)
	if err != nil {
		t.Fatal(err)
	}
	backend := &Backend{
		paths:     layout.NewPaths(t.TempDir()),
		admission: controller,
		events:    lifecycle.NewEventBus(0),
		transfers: transfers,
	}
	err = backend.RestoreVolumeBackup(context.Background(), volumeID, types.RestoreVolumeBackup{
		Manifest: types.VolumeBackupObject{ArtifactID: artifactID, DownloadURL: server.URL + "/manifest", DataKey: dataKey},
		Packs: []types.VolumeBackupObject{
			{ArtifactID: artifactID, DownloadURL: server.URL + "/pack", DataKey: dataKey},
		},
		ExpectedVolumeSizeBytes: rawSize,
		VerifyOnly:              true,
	})
	if err != nil {
		t.Fatalf("verify node-independent volume backup: %v", err)
	}
}

func TestValidateRecoveredExt4RejectsInvalidFilesystem(t *testing.T) {
	path := filepath.Join(t.TempDir(), "invalid.raw")
	if err := os.WriteFile(path, []byte("not an ext4 filesystem"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := validateRecoveredExt4(context.Background(), path); err == nil {
		t.Fatal("expected invalid recovered filesystem to be rejected")
	}
}

func TestInstanceVolumeBackupRejectsStaleControlPlaneFence(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	manager := volumes.NewManager(paths)
	volumeID := uuid.NewString()
	instanceID := uuid.NewString()
	fencingToken := uuid.NewString()
	if _, err := manager.Ensure(t.Context(), volumes.EnsureRequest{
		ID: volumeID, Name: "data", SizeGiB: 1, Filesystem: volumes.FilesystemExt4,
	}); err != nil {
		t.Fatalf("ensure volume: %v", err)
	}
	mounted, err := manager.Attach(t.Context(), volumeID, volumes.AttachRequest{
		InstanceID: instanceID, MountPath: "/data", Generation: 3,
		FencingToken: fencingToken,
	})
	if err != nil {
		t.Fatalf("attach volume: %v", err)
	}
	if err := state.WriteInstanceMetadata(paths, state.InstanceMetadata{
		ID: instanceID, State: types.RuntimeStateStopped,
		VolumeAttachments: []volumes.MountedVolume{mounted},
	}); err != nil {
		t.Fatalf("write instance metadata: %v", err)
	}
	backend := &Backend{
		paths: paths, volumes: manager, lifecycle: lifecycle.NewCoordinator(),
	}
	err = backend.snapshotInstanceVolumeSet(t.Context(), instanceID, []volumeBackupWork{{
		volumeID: volumeID, artifactID: uuid.NewString(),
		attachmentGeneration: 2, fencingToken: fencingToken,
		rawPath: filepath.Join(t.TempDir(), "volume.raw"),
	}})
	if err == nil {
		t.Fatal("expected stale attachment generation to be rejected")
	}
}

func TestWritableVolumeMountPathsFreezesOnlyBackedUpWritableVolumes(t *testing.T) {
	backedUp, readOnly, other := uuid.NewString(), uuid.NewString(), uuid.NewString()
	metadata := state.InstanceMetadata{VolumeAttachments: []volumes.MountedVolume{
		{VolumeID: backedUp, MountPath: "/data"},
		{VolumeID: readOnly, MountPath: "/reference", ReadOnly: true},
		{VolumeID: other, MountPath: "/scratch"},
	}}
	work := []volumeBackupWork{{volumeID: backedUp}, {volumeID: readOnly}}
	if got := writableVolumeMountPaths(metadata, work); !slices.Equal(got, []string{"/data"}) {
		t.Fatalf("frozen mount paths = %v, want [/data]", got)
	}
}
