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
	"io/fs"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/registry"
	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

const (
	staleCacheFormat    = "v1"
	staleRootfsBytes    = 1 << 20
	cacheFileMode       = 0o600
	cacheDirectoryMode  = 0o755
	unrelatedImagesFile = "scratch"
)

func treeBytes(t *testing.T, root string) int64 {
	t.Helper()
	var total int64
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil || !entry.Type().IsRegular() {
			return walkErr
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		total += info.Size()
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return total
}

func writeCacheFile(t *testing.T, path string, size int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), cacheDirectoryMode); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, make([]byte, size), cacheFileMode); err != nil {
		t.Fatal(err)
	}
}

func openTestStore(t *testing.T, paths layout.Paths) *ImageStore {
	t.Helper()
	store, err := NewImageStore(ImageStoreConfig{Paths: paths, Formatter: testFormatter(t)})
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func TestOpeningTheStoreReclaimsCacheNoPreparedImageHolds(t *testing.T) {
	paths := layout.NewPaths(t.TempDir())
	store := openTestStore(t, paths)
	prepared, err := store.ImportImage(context.Background(), "registry.internal/snapflow/held:v1", testImage(t, baseLayer(t)))
	if err != nil {
		t.Fatal(err)
	}
	orphan := testImage(t, whiteoutLayer(t), rootLayer(t))
	orphanDigest, err := orphan.Digest()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.layout.PullImage(context.Background(), orphan, orphanDigest.Hex); err != nil {
		t.Fatal(err)
	}
	imagesRoot := filepath.Dir(paths.ImagesDir())
	writeCacheFile(t, filepath.Join(imagesRoot, staleCacheFormat, "library", "digest", layout.ImageDiskName), staleRootfsBytes)
	unrelated := filepath.Join(imagesRoot, unrelatedImagesFile, layout.ImageDiskName)
	writeCacheFile(t, unrelated, staleRootfsBytes)
	layoutBefore := treeBytes(t, paths.SystemOCICache())

	reopened := openTestStore(t, paths)

	if _, err := os.Stat(filepath.Join(imagesRoot, staleCacheFormat)); !os.IsNotExist(err) {
		t.Fatalf("stale cache format was kept: %v", err)
	}
	if _, err := os.Stat(unrelated); err != nil {
		t.Fatalf("unrelated images directory entry was removed: %v", err)
	}
	if _, err := reopened.layout.Image(orphanDigest.Hex); err == nil {
		t.Fatal("OCI layout entry no prepared image holds was kept")
	}
	if _, err := reopened.layout.Image(prepared.DigestHex()); err != nil {
		t.Fatalf("OCI layout entry of a prepared image was removed: %v", err)
	}
	if after := treeBytes(t, paths.SystemOCICache()); after >= layoutBefore {
		t.Fatalf("OCI layout holds %d bytes after reclaiming, %d before", after, layoutBefore)
	}
}

func installTestDiskArtifact(t *testing.T, store *ImageStore, server *httptest.Server, source gcr.Image) ImageRecord {
	t.Helper()
	artifact, _ := buildTestDiskArtifact(t, store.formatter, source)
	digest, err := artifact.Digest()
	if err != nil {
		t.Fatal(err)
	}
	endpoint, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	tag, err := name.ParseReference(endpoint.Host+"/"+testBundleRepository+":"+digest.Hex[:12], name.Insecure)
	if err != nil {
		t.Fatal(err)
	}
	if err := remote.Write(tag, artifact); err != nil {
		t.Fatal(err)
	}
	reference := endpoint.Host + "/" + testBundleRepository + "@" + digest.String()
	record, err := store.EnsureDiskArtifact(context.Background(), reference, &types.Registry{URL: server.URL}, "linux/amd64")
	if err != nil {
		t.Fatal(err)
	}
	return record
}

func TestReleaseDiskArtifactsReclaimsUnheldVersions(t *testing.T) {
	server := httptest.NewServer(registry.New())
	t.Cleanup(server.Close)
	store := newTestStore(t)
	stale := installTestDiskArtifact(t, store, server, testImage(t, baseLayer(t)))
	held := installTestDiskArtifact(t, store, server, testImage(t, baseLayer(t), whiteoutLayer(t)))
	current := installTestDiskArtifact(t, store, server, testImage(t, baseLayer(t), whiteoutLayer(t), rootLayer(t)))
	repositoryDir := filepath.Join(store.paths.ImagesDir(), current.Repository)
	before := treeBytes(t, repositoryDir)
	protected := map[string]bool{store.paths.ImageDigestDir(held.Repository, held.DigestHex()): true}

	released, err := store.ReleaseDiskArtifacts(context.Background(), current.Repository, map[string]bool{current.Digest: true}, protected)
	if err != nil {
		t.Fatal(err)
	}
	if released != 1 {
		t.Fatalf("released %d disk artifacts, want 1", released)
	}
	if reclaimed := before - treeBytes(t, repositoryDir); reclaimed < stale.SizeBytes {
		t.Fatalf("reclaimed %d bytes, want at least the stale filesystem's %d", reclaimed, stale.SizeBytes)
	}
	if _, err := os.Stat(store.paths.ImageDigestDir(stale.Repository, stale.DigestHex())); !os.IsNotExist(err) {
		t.Fatalf("stale disk artifact was kept: %v", err)
	}
	for _, kept := range []ImageRecord{held, current} {
		if _, err := os.Stat(store.paths.ImageDisk(kept.Repository, kept.DigestHex())); err != nil {
			t.Fatalf("disk artifact %s was removed: %v", kept.Digest, err)
		}
	}
}
