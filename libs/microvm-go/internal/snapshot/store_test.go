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

package snapshot

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

func TestCreateStoppedSnapshotPersistsPayloadAndRecord(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	store := NewStore(paths)
	metadata := state.InstanceMetadata{
		ID:          "instance-1",
		Image:       "example.com/app:latest",
		Hypervisor:  hypervisor.HypervisorFirecracker,
		OverlayDisk: filepath.Join(t.TempDir(), "overlay.raw"),
		ConfigDisk:  filepath.Join(t.TempDir(), "config.ext4"),
		State:       types.RuntimeStateStopped,
	}
	if err := os.WriteFile(metadata.OverlayDisk, []byte("overlay"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(metadata.ConfigDisk, []byte("config"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := state.WriteInstanceMetadata(paths, metadata); err != nil {
		t.Fatal(err)
	}

	snap, err := store.CreateStoppedWithID(uuid.NewString(), metadata, "manual")
	if err != nil {
		t.Fatal(err)
	}
	if snap.Kind != KindStopped {
		t.Fatalf("kind = %q", snap.Kind)
	}
	if snap.SourceInstanceID != metadata.ID {
		t.Fatalf("source instance = %q", snap.SourceInstanceID)
	}

	record, err := store.LoadRecord(snap.ID)
	if err != nil {
		t.Fatal(err)
	}
	if record.Snapshot.ID != snap.ID {
		t.Fatalf("record snapshot id = %q", record.Snapshot.ID)
	}
	if _, err := os.Stat(filepath.Join(paths.SnapshotPayloadDir(snap.ID), "overlay.raw")); err != nil {
		t.Fatal(err)
	}
	assertSnapshotPermissions(t, paths.SnapshotDir(snap.ID))
	if _, err := os.Lstat(paths.InstanceLatestSnapshot(metadata.ID)); !os.IsNotExist(err) {
		t.Fatalf("saved snapshot must not occupy transient standby path, got %v", err)
	}
}

func assertSnapshotPermissions(t *testing.T, root string) {
	t.Helper()
	if err := filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.IsDir() && info.Mode().Perm() != snapshotDirectoryPermissions {
			t.Errorf("directory %s permissions = %o, want %o", path, info.Mode().Perm(), snapshotDirectoryPermissions)
		}
		if info.Mode().IsRegular() && info.Mode().Perm() != snapshotFilePermissions {
			t.Errorf("file %s permissions = %o, want %o", path, info.Mode().Perm(), snapshotFilePermissions)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}
