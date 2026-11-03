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

package state

import (
	"os"
	"testing"

	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

func TestPersistentCreateRequestRemovesOperationSecrets(t *testing.T) {
	request := types.CreateRequest{
		ID:        "00000000-0000-4000-8000-000000000003",
		SecretEnv: map[string]string{"TOKEN": "secret"},
		Registry:  &types.Registry{URL: "registry.example", Username: "user", Password: "secret"},
		Volumes: []types.VolumeAttachment{{
			ID:      "00000000-0000-4000-8000-000000000004",
			Restore: &types.RestoreVolumeBackup{Manifest: types.VolumeBackupObject{DownloadURL: "https://signed.example/download", DataKey: "secret"}},
		}},
	}

	persistent := types.PersistentCreateRequest(request)

	if persistent.SecretEnv != nil || persistent.Registry != nil || persistent.Volumes[0].Restore != nil {
		t.Fatalf("persistent create request retained operation secrets: %#v", persistent)
	}
	if request.SecretEnv == nil || request.Registry == nil || request.Volumes[0].Restore == nil {
		t.Fatal("sanitizing the persistent request mutated the delivery request")
	}
}

func TestListInstanceMetadataFailsClosedOnCorruptMetadata(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	id := "00000000-0000-4000-8000-000000000001"
	if err := os.MkdirAll(paths.InstanceDir(id), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.InstanceMetadata(id), []byte("{"), 0o600); err != nil {
		t.Fatal(err)
	}

	if _, err := ListInstanceMetadata(paths); err == nil {
		t.Fatal("expected corrupt instance metadata to fail the listing")
	}
}

func TestListInstanceMetadataIgnoresIncompleteDirectory(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	id := "00000000-0000-4000-8000-000000000002"
	if err := os.MkdirAll(paths.InstanceDir(id), 0o755); err != nil {
		t.Fatal(err)
	}

	metadata, err := ListInstanceMetadata(paths)
	if err != nil {
		t.Fatal(err)
	}
	if len(metadata) != 0 {
		t.Fatalf("metadata count = %d, want 0", len(metadata))
	}
}

func TestReadInstanceMetadataRejectsTraversal(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	if _, err := ReadInstanceMetadata(paths, ".."); err == nil {
		t.Fatal("expected traversal ID to be rejected")
	}
}
