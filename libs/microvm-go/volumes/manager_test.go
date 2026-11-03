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

package volumes

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/layout"
)

func TestManagerRejectsInvalidVolumeIdentityAndSize(t *testing.T) {
	manager := NewManager(layout.NewPaths(t.TempDir()))
	if _, err := manager.Get(context.Background(), "../outside"); err == nil {
		t.Fatal("Get accepted a path-traversing volume ID")
	}
	if err := manager.Delete(context.Background(), "../outside"); err == nil {
		t.Fatal("Delete accepted a path-traversing volume ID")
	}
	if _, err := manager.Ensure(context.Background(), EnsureRequest{
		ID: uuid.NewString(), Name: "oversized", SizeGiB: maxVolumeSizeGiB + 1,
	}); err == nil {
		t.Fatal("Ensure accepted a volume size that overflows its byte representation")
	}
}

func TestAttachmentFencingRejectsStaleAndConcurrentOwners(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	manager := NewManager(paths, WithBlockStore(&testBlockStore{path: filepath.Join(paths.VolumeDir("device"), "data.raw")}))
	volume := Volume{
		ID: "3ad713fa-54c5-4272-8e68-63dcf92314ea", Name: "data",
		SizeGiB: 10, Filesystem: FilesystemExt4, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	if err := os.MkdirAll(paths.VolumeDir(volume.ID), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := save(paths, volume); err != nil {
		t.Fatal(err)
	}

	first := AttachRequest{
		InstanceID: "instance-a", MountPath: "/data", Generation: 1,
		FencingToken: "c21daf30-6203-4ca9-8e78-c26d1b1bc0bc",
	}
	if _, err := manager.Attach(context.Background(), volume.ID, first); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Attach(context.Background(), volume.ID, first); err != nil {
		t.Fatalf("idempotent attach failed: %v", err)
	}
	_, err := manager.Attach(context.Background(), volume.ID, AttachRequest{
		InstanceID: "instance-b", MountPath: "/data", Generation: 2,
		FencingToken: "e010a501-3b26-4367-8ea2-ed2aa8b601ac",
	})
	if !errors.Is(err, ErrInUse) {
		t.Fatalf("concurrent attach error = %v, want ErrInUse", err)
	}
	if err := manager.Detach(context.Background(), volume.ID, "instance-a", first.FencingToken); err != nil {
		t.Fatal(err)
	}
	_, err = manager.Attach(context.Background(), volume.ID, AttachRequest{
		InstanceID: "instance-b", MountPath: "/data", Generation: 1,
		FencingToken: "e010a501-3b26-4367-8ea2-ed2aa8b601ac",
	})
	if !errors.Is(err, ErrFenceRejected) {
		t.Fatalf("stale attach error = %v, want ErrFenceRejected", err)
	}
}

type testBlockStore struct {
	path          string
	resizedVolume string
	resizeBytes   int64
}

func (store *testBlockStore) Kind() string                                { return "test" }
func (store *testBlockStore) Ensure(context.Context, EnsureRequest) error { return nil }
func (store *testBlockStore) Attach(context.Context, string) (string, error) {
	return store.path, nil
}
func (store *testBlockStore) Detach(context.Context, string, string) error         { return nil }
func (store *testBlockStore) Delete(context.Context, string) error                 { return nil }
func (store *testBlockStore) Snapshot(context.Context, string, string) error       { return nil }
func (store *testBlockStore) Restore(context.Context, string, string, int64) error { return nil }
func (store *testBlockStore) Resize(ctx context.Context, volumeID string, targetBytes int64) error {
	store.resizedVolume = volumeID
	store.resizeBytes = targetBytes
	return ctx.Err()
}

func TestManagerResizesOnlyDetachedVolumes(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	store := &testBlockStore{}
	manager := NewManager(paths, WithBlockStore(store))
	volume := Volume{
		ID: uuid.NewString(), Name: "data", SizeGiB: 10, Filesystem: FilesystemExt4,
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	if err := os.MkdirAll(paths.VolumeDir(volume.ID), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := save(paths, volume); err != nil {
		t.Fatal(err)
	}
	resized, err := manager.Resize(context.Background(), volume.ID, 12)
	if err != nil {
		t.Fatalf("resize detached volume: %v", err)
	}
	if resized.SizeGiB != 12 || store.resizeBytes != 12*gib || store.resizedVolume != volume.ID {
		t.Fatalf("unexpected resize result: volume=%d store=%d of %q", resized.SizeGiB, store.resizeBytes, store.resizedVolume)
	}
	resized.Attachment = &Attachment{InstanceID: "instance", Generation: 1, FencingToken: uuid.NewString()}
	if err := save(paths, resized); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Resize(context.Background(), volume.ID, 14); !errors.Is(err, ErrInUse) {
		t.Fatalf("attached resize error = %v, want ErrInUse", err)
	}
}

func TestMountPathValidation(t *testing.T) {
	for _, value := range []string{"", "/", "relative", "/data/../secret"} {
		if err := validateMountPath(value); err == nil {
			t.Errorf("validateMountPath(%q) unexpectedly succeeded", value)
		}
	}
	for _, value := range []string{"/data", "/var/lib/app.data"} {
		if err := validateMountPath(value); err != nil {
			t.Errorf("validateMountPath(%q): %v", value, err)
		}
	}
}
