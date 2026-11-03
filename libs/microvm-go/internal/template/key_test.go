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

package template

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
)

const templateOwnedArtifactBytes = 31

func TestKeyIDSurvivesManifestRoundTrip(t *testing.T) {
	key := Key{
		SchemaVersion:         KeySchemaVersion,
		SnapshotFormat:        SnapshotFormat,
		PlatformBundleDigests: []string{},
	}
	data, err := json.Marshal(manifest{Key: key})
	if err != nil {
		t.Fatal(err)
	}
	decoded := manifest{}
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	want, err := KeyID(key)
	if err != nil {
		t.Fatal(err)
	}
	got, err := KeyID(decoded.Key)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("round-tripped template key ID = %q, want %q", got, want)
	}
}

func TestKeyIncludesCompatibilitySensitiveInputs(t *testing.T) {
	base := Key{
		SchemaVersion:         KeySchemaVersion,
		SnapshotFormat:        SnapshotFormat,
		ImageDigest:           "image",
		ImageCacheFormat:      "v1",
		FirecrackerDigest:     "firecracker",
		KernelDigest:          "kernel",
		InitrdDigest:          "initrd",
		PlatformBundleDigests: []string{"sha256:platform-bundle"},
		GuestConfigDigest:     "guest-config",
		NetworkDigest:         "network",
		CPUSignature:          "cpu",
		CPUTemplate:           FirecrackerCPUTemplate,
		HostKernelRelease:     "host-kernel",
		Platform:              "linux/amd64",
		CPUVCPUs:              4,
		MemoryGiB:             8,
		StorageGiB:            30,
	}
	baseID, err := KeyID(base)
	if err != nil {
		t.Fatal(err)
	}
	for name, change := range map[string]func(*Key){
		"root filesystem format": func(key *Key) { key.ImageCacheFormat = "v2" },
		"toolbox identity":       func(key *Key) { key.PlatformBundleDigests = []string{"sha256:new-platform-bundle"} },
		"CPU template":           func(key *Key) { key.CPUTemplate = "custom" },
	} {
		changed := base
		change(&changed)
		changedID, err := KeyID(changed)
		if err != nil {
			t.Fatal(err)
		}
		if changedID == baseID {
			t.Fatalf("%s did not affect the template key", name)
		}
	}
}

func TestDigestDetectsSameSizeCorruption(t *testing.T) {
	path := filepath.Join(t.TempDir(), "artifact")
	if err := os.WriteFile(path, []byte("original"), templateFilePerm); err != nil {
		t.Fatal(err)
	}
	cache := &Cache{}
	original, err := cache.Digest(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("corrupt!"), templateFilePerm); err != nil {
		t.Fatal(err)
	}
	changedAt := time.Now().Add(time.Second)
	if err := os.Chtimes(path, changedAt, changedAt); err != nil {
		t.Fatal(err)
	}
	corrupt, err := cache.Digest(path)
	if err != nil {
		t.Fatal(err)
	}
	if corrupt == original {
		t.Fatal("same-size artifact corruption reused a stale digest")
	}
}

func TestLogicalBytesIncludesOnlyTemplateOwnedArtifacts(t *testing.T) {
	stored := manifest{Artifacts: artifacts{
		SnapshotState:   artifact{Size: 1},
		SnapshotMemory:  artifact{Size: 2},
		OverlayDisk:     artifact{Size: 4},
		ConfigDisk:      artifact{Size: 8},
		RootFilesystem:  artifact{Size: 16},
		PlatformBundles: []artifact{{Size: 32}},
	}}
	if got := stored.logicalBytes(); got != templateOwnedArtifactBytes {
		t.Fatalf("logicalBytes() = %d, want %d", got, templateOwnedArtifactBytes)
	}
}

func TestPlatformBundleRequiresMatchingExternalArtifact(t *testing.T) {
	key := Key{PlatformBundleDigests: []string{"sha256:expected"}}
	metadata := state.InstanceMetadata{PlatformBundles: []state.PlatformBundleMetadata{{
		Digest: "sha256:expected",
	}}}
	bundles := []artifact{{Size: 1, SHA256: "disk-digest"}}
	if err := validatePlatformBundles(metadata, key, bundles); err != nil {
		t.Fatalf("matching platform bundle was rejected: %v", err)
	}
	metadata.PlatformBundles[0].Digest = "sha256:stale"
	if err := validatePlatformBundles(metadata, key, bundles); err == nil {
		t.Fatal("stale platform bundle digest was accepted")
	}
	if err := validatePlatformBundles(state.InstanceMetadata{}, key, nil); err == nil {
		t.Fatal("missing external platform bundle artifact was accepted")
	}
}
