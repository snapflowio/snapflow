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

package imagecache

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/snapflowio/microvm-go/types"
)

const testImageDigest = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

func TestEnsureUsesPreparedVersionedImage(t *testing.T) {
	store, record := seedReadyImage(t, "docker.io/library/alpine:3.21")

	got, err := store.Ensure(context.Background(), record.Reference, nil, record.Platform, "")
	if err != nil {
		t.Fatal(err)
	}
	if got.Digest != record.Digest {
		t.Fatalf("digest = %q, want %q", got.Digest, record.Digest)
	}
}

func TestEnsureNeverRejectsMissingPreparedImage(t *testing.T) {
	store := newTestStore(t)
	_, err := store.Ensure(context.Background(), "docker.io/library/alpine:3.21", nil, "linux/amd64", types.ImagePullNever)
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("error = %v, want os.ErrNotExist", err)
	}
}

func TestMaterializeResolvedDeduplicatesReadyDigest(t *testing.T) {
	store, record := seedReadyImage(t, "docker.io/library/alpine:3.21")
	if err := os.Remove(store.paths.ImageTagLink(record.Repository, "3.21")); err != nil {
		t.Fatal(err)
	}

	got, err := store.materializeResolved(context.Background(), ImageMetadata{
		Reference:  record.Reference,
		Repository: record.Repository,
		Digest:     record.Digest,
		Platform:   Platform{OS: "linux", Architecture: "amd64"},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got.Digest != record.Digest {
		t.Fatalf("digest = %q, want %q", got.Digest, record.Digest)
	}
	if _, err := os.Lstat(store.paths.ImageTagLink(record.Repository, "3.21")); err != nil {
		t.Fatalf("tag link was not restored: %v", err)
	}
}

func TestReadyDigestsReportsValidatedPreparedImages(t *testing.T) {
	store, record := seedReadyImage(t, "docker.io/library/alpine:3.21")
	digests, err := store.ReadyDigests()
	if err != nil {
		t.Fatal(err)
	}
	if len(digests) != 1 || digests[0] != record.Digest {
		t.Fatalf("ready digests = %v, want [%s]", digests, record.Digest)
	}
	if err := os.Remove(store.paths.ImageDisk(record.Repository, record.DigestHex())); err != nil {
		t.Fatal(err)
	}
	digests, err = store.ReadyDigests()
	if err != nil {
		t.Fatal(err)
	}
	if len(digests) != 0 {
		t.Fatalf("ready digests = %v after removing filesystem, want none", digests)
	}
}

func TestTagLinksPreparedFilesystemAcrossRepositories(t *testing.T) {
	store, source := seedReadyImage(t, "docker.io/library/alpine:3.21")
	targetReference := "registry.internal/snapflow/alpine:prepared"

	if err := store.Tag(source.Reference, targetReference); err != nil {
		t.Fatal(err)
	}
	target, err := store.ReadReference(targetReference)
	if err != nil {
		t.Fatal(err)
	}
	platform, err := ParsePlatform(target.Platform)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.validateReady(target, platform); err != nil {
		t.Fatalf("tagged image is not ready: %v", err)
	}
	sourceInfo, err := os.Stat(store.paths.ImageDisk(source.Repository, source.DigestHex()))
	if err != nil {
		t.Fatal(err)
	}
	targetInfo, err := os.Stat(store.paths.ImageDisk(target.Repository, target.DigestHex()))
	if err != nil {
		t.Fatal(err)
	}
	if !os.SameFile(sourceInfo, targetInfo) {
		t.Fatal("tagged filesystem does not share the immutable prepared artifact")
	}
}

func TestReadyDigestsIgnoresIncompletePreparedImages(t *testing.T) {
	store, record := seedReadyImage(t, "docker.io/library/alpine:3.21")
	record.Status = ImageStatusResolved
	if err := store.Write(record); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(store.paths.ImageDisk(record.Repository, record.DigestHex())); err != nil {
		t.Fatal(err)
	}

	digests, err := store.ReadyDigests()
	if err != nil {
		t.Fatal(err)
	}
	if len(digests) != 0 {
		t.Fatalf("ready digests = %v, want none", digests)
	}
}

func TestNormalizePullPolicy(t *testing.T) {
	tests := []struct {
		name      string
		image     string
		requested types.ImagePullPolicy
		want      types.ImagePullPolicy
		wantError bool
	}{
		{name: "versioned tag", image: "alpine:3.21", want: types.ImagePullIfNotPresent},
		{name: "implicit latest", image: "alpine", want: types.ImagePullAlways},
		{name: "explicit latest", image: "alpine:latest", want: types.ImagePullAlways},
		{name: "digest", image: "alpine@" + testImageDigest, want: types.ImagePullIfNotPresent},
		{name: "explicit never", image: "alpine:latest", requested: types.ImagePullNever, want: types.ImagePullNever},
		{name: "invalid", image: "alpine:3.21", requested: "Sometimes", wantError: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := normalizePullPolicy(test.image, test.requested)
			if test.wantError {
				if err == nil {
					t.Fatal("expected an error")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got != test.want {
				t.Fatalf("policy = %q, want %q", got, test.want)
			}
		})
	}
}

func seedReadyImage(t *testing.T, reference string) (*ImageStore, ImageRecord) {
	t.Helper()
	store := newTestStore(t)
	paths := store.paths
	ref, err := ParseImageRef(reference)
	if err != nil {
		t.Fatal(err)
	}
	record := ImageRecord{
		Reference:  ref.String(),
		Repository: ref.Repository(),
		Digest:     testImageDigest,
		Platform:   "linux/amd64",
		Status:     ImageStatusReady,
		SizeBytes:  8,
	}
	diskPath := paths.ImageDisk(record.Repository, record.DigestHex())
	if err := os.MkdirAll(filepath.Dir(diskPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(diskPath, []byte("prepared"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := store.Write(record); err != nil {
		t.Fatal(err)
	}
	if err := store.LinkTag(record.Repository, ref.Tag(), record.DigestHex()); err != nil {
		t.Fatal(err)
	}
	return store, record
}
