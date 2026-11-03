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
	"bytes"
	"context"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/registry"
	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/snapflowio/microvm-go/types"
)

const testBundleRepository = "platform/core"

func buildTestDiskArtifact(t *testing.T, formatter *ErofsFormatter, source gcr.Image) (gcr.Image, string) {
	t.Helper()
	workDir := t.TempDir()
	artifact, err := formatter.BuildDiskArtifact(context.Background(), DiskArtifactRequest{Source: source, WorkDir: workDir})
	if err != nil {
		t.Fatal(err)
	}
	return artifact, filepath.Join(workDir, diskArtifactFileName)
}

func TestDiskArtifactIsReproducibleAndInstallsVerifiedFilesystem(t *testing.T) {
	formatter := testFormatter(t)
	source := testImage(t, baseLayer(t), whiteoutLayer(t), rootLayer(t))
	artifact, builtDisk := buildTestDiskArtifact(t, formatter, source)
	rebuilt, _ := buildTestDiskArtifact(t, formatter, source)
	digest, err := artifact.Digest()
	if err != nil {
		t.Fatal(err)
	}
	rebuiltDigest, err := rebuilt.Digest()
	if err != nil {
		t.Fatal(err)
	}
	if digest != rebuiltDigest {
		t.Fatalf("rebuilt artifact digest %s differs from %s", rebuiltDigest, digest)
	}

	server := httptest.NewServer(registry.New())
	t.Cleanup(server.Close)
	endpoint, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	tag, err := name.ParseReference(endpoint.Host+"/"+testBundleRepository+":disk", name.Insecure)
	if err != nil {
		t.Fatal(err)
	}
	if err := remote.Write(tag, artifact); err != nil {
		t.Fatal(err)
	}

	store := newTestStore(t)
	reference := endpoint.Host + "/" + testBundleRepository + "@" + digest.String()
	record, err := store.EnsureDiskArtifact(context.Background(), reference, &types.Registry{URL: server.URL}, "linux/amd64")
	if err != nil {
		t.Fatal(err)
	}
	if record.Digest != digest.String() || record.Status != ImageStatusReady {
		t.Fatalf("record = %+v, want ready artifact %s", record, digest)
	}
	installed, err := os.ReadFile(store.paths.ImageDisk(record.Repository, record.DigestHex()))
	if err != nil {
		t.Fatal(err)
	}
	built, err := os.ReadFile(builtDisk)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(installed, built) {
		t.Fatal("installed filesystem differs from the built filesystem")
	}
	if tree := readErofsTree(t, store.paths.ImageDisk(record.Repository, record.DigestHex())); tree["kind/child"].content != "child" {
		t.Fatalf("installed filesystem is missing content: %+v", tree["kind/child"])
	}
}

func TestEnsureDiskArtifactRejectsMutableReference(t *testing.T) {
	store := newTestStore(t)
	if _, err := store.EnsureDiskArtifact(context.Background(), "registry.internal/platform/core:latest", nil, "linux/amd64"); err == nil {
		t.Fatal("expected a mutable disk artifact reference to be rejected")
	}
}
