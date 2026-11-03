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

package diskusage

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/snapflowio/microvm-go/layout"
)

func TestCollectMissingDirectories(t *testing.T) {
	breakdown, err := Collect(layout.NewPaths(t.TempDir()), SupportInstances{})
	if err != nil {
		t.Fatalf("Collect: %v", err)
	}
	if breakdown != (Breakdown{}) {
		t.Fatalf("expected empty breakdown, got %#v", breakdown)
	}
}

func TestCollectBreakdown(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	writeFile(t, filepath.Join(paths.ImagesDir(), "repo", "digest", "rootfs.erofs"))
	writeFile(t, filepath.Join(paths.SystemOCICache(), "blobs", "sha256", "blob"))
	writeFile(t, paths.InstanceOverlay("instance-1"))
	writeFile(t, filepath.Join(paths.InstanceLatestSnapshot("instance-1"), "memory"))
	writeFile(t, filepath.Join(paths.SnapshotsDir(), "snapshot-1", "payload", "overlay.raw"))
	writeFile(t, paths.InstanceOverlay("seed-1"))
	writeFile(t, filepath.Join(paths.InstanceLatestSnapshot("seed-1"), "memory"))
	writeFile(t, paths.InstanceOverlay("builder-1"))
	writeFile(t, paths.SystemBuilderState("tenant-1"))

	breakdown, err := Collect(paths, SupportInstances{TemplateSeeds: []string{"seed-1"}, Builders: []string{"builder-1"}})
	if err != nil {
		t.Fatalf("Collect: %v", err)
	}
	if breakdown.Images <= 0 {
		t.Fatalf("expected image bytes, got %#v", breakdown)
	}
	if breakdown.OCICache <= 0 {
		t.Fatalf("expected OCI cache bytes, got %#v", breakdown)
	}
	if breakdown.InstanceOverlays <= 0 {
		t.Fatalf("expected instance overlay bytes, got %#v", breakdown)
	}
	if breakdown.InstanceSnapshots <= 0 {
		t.Fatalf("expected instance standby snapshot bytes, got %#v", breakdown)
	}
	if breakdown.Snapshots <= 0 {
		t.Fatalf("expected snapshot bytes, got %#v", breakdown)
	}
	if breakdown.BuilderOverlays <= 0 || breakdown.BuilderState <= 0 {
		t.Fatalf("expected organization builder disk bytes, got %#v", breakdown)
	}
	if breakdown.FixedSupportBytes() != breakdown.Images+breakdown.OCICache+breakdown.InstanceSnapshots+breakdown.Snapshots+breakdown.BuilderOverlays+breakdown.BuilderState {
		t.Fatalf("unexpected fixed support bytes: %#v", breakdown)
	}
}

func TestCollectSeparatesReclaimableTemplateSeedsFromFixedSupportDisk(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	writeFile(t, filepath.Join(paths.InstanceLatestSnapshot("instance-1"), "memory"))
	writeFile(t, filepath.Join(paths.InstanceLatestSnapshot("seed-1"), "memory"))
	writeFile(t, paths.InstanceOverlay("seed-1"))
	withoutSeed, err := Collect(paths, SupportInstances{})
	if err != nil {
		t.Fatal(err)
	}

	breakdown, err := Collect(paths, SupportInstances{TemplateSeeds: []string{"seed-1"}})
	if err != nil {
		t.Fatal(err)
	}

	if breakdown.ReclaimableBytes() <= 0 {
		t.Fatalf("expected reclaimable template seed bytes, got %#v", breakdown)
	}
	if breakdown.InstanceSnapshots >= withoutSeed.InstanceSnapshots {
		t.Fatalf("template seed snapshots stayed in fixed support disk: %#v", breakdown)
	}
	if breakdown.FixedSupportBytes()+breakdown.ReclaimableBytes() < withoutSeed.FixedSupportBytes() {
		t.Fatalf("reclassifying template seeds lost bytes: %#v vs %#v", breakdown, withoutSeed)
	}
}

func writeFile(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte("snapflow"), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}
