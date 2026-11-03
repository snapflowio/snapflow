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

package builds

import (
	"archive/tar"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pelletier/go-toml/v2"
	"github.com/snapflowio/microvm-go/types"
)

const testGateway = "172.31.0.1"

func testCacheRegistry(url, project string) *types.Registry {
	return &types.Registry{URL: url, Project: &project, Username: "snapflow-token", Password: "credential"}
}

func TestCacheRegistryTranslatesHostLoopbackToTheGuestGateway(t *testing.T) {
	for url, want := range map[string]string{
		"http://localhost:5001":           testGateway + ":5001",
		"http://127.0.0.1:5001":           testGateway + ":5001",
		"https://snapshots.example.com":   "snapshots.example.com",
		"https://snapshots.example.com:8": "snapshots.example.com:8",
	} {
		resolved, err := resolveCacheRegistry(testCacheRegistry(url, "transient/org-a/buildcache"), testGateway)
		if err != nil {
			t.Fatalf("resolveCacheRegistry(%s) error = %v", url, err)
		}
		if resolved.host != want {
			t.Fatalf("resolveCacheRegistry(%s) host = %q, want %q", url, resolved.host, want)
		}
		if resolved.insecure != strings.HasPrefix(url, "http://") {
			t.Fatalf("resolveCacheRegistry(%s) insecure = %t", url, resolved.insecure)
		}
	}
}

func TestCacheRegistryRequiresAScopedCredential(t *testing.T) {
	for name, registry := range map[string]*types.Registry{
		"missing":    nil,
		"no project": {URL: "https://cache.example.com", Username: "u", Password: "p"},
		"anonymous":  testCacheRegistry("https://cache.example.com", "transient/org-a/buildcache"),
	} {
		if name == "anonymous" {
			registry.Username, registry.Password = "", ""
		}
		if _, err := resolveCacheRegistry(registry, testGateway); err == nil {
			t.Fatalf("%s cache registry was accepted", name)
		}
	}
}

func TestCacheReferencesAreKeyedByOrganizationAndDockerfile(t *testing.T) {
	first, err := resolveCacheRegistry(testCacheRegistry("https://cache.example.com", "/transient/org-a/buildcache/"), testGateway)
	if err != nil {
		t.Fatal(err)
	}
	other, err := resolveCacheRegistry(testCacheRegistry("https://cache.example.com", "transient/org-b/buildcache"), testGateway)
	if err != nil {
		t.Fatal(err)
	}
	reference := first.reference("FROM alpine\n")
	if !strings.HasPrefix(reference, "cache.example.com/transient/org-a/buildcache/") || !strings.HasSuffix(reference, ":"+buildCacheTag) {
		t.Fatalf("reference = %q", reference)
	}
	if reference != first.reference("FROM alpine\n") {
		t.Fatal("cache reference is not deterministic")
	}
	if reference == first.reference("FROM alpine:3\n") {
		t.Fatal("different Dockerfiles share a cache reference")
	}
	if otherReference := other.reference("FROM alpine\n"); !strings.HasPrefix(otherReference, "cache.example.com/transient/org-b/buildcache/") {
		t.Fatalf("another organization's reference = %q, want its own namespace", otherReference)
	}
	imports, exports := first.cacheImports("FROM alpine\n"), first.cacheExports("FROM alpine\n")
	if len(imports) != 1 || imports[0].Type != registryCacheType || imports[0].Attrs[cacheReferenceAttribute] != reference {
		t.Fatalf("cache imports = %+v", imports)
	}
	if len(exports) != 1 || exports[0].Attrs[cacheReferenceAttribute] != reference ||
		exports[0].Attrs[cacheModeAttribute] != cacheModeMax || exports[0].Attrs[cacheIgnoreErrorAttribute] != enabledAttribute {
		t.Fatalf("cache exports = %+v", exports)
	}
}

func TestBuildkitConfigMirrorsDockerHubThroughTheCacheRegistry(t *testing.T) {
	registry, err := resolveCacheRegistry(testCacheRegistry("http://localhost:5001", "transient/org-a/buildcache"), testGateway)
	if err != nil {
		t.Fatal(err)
	}
	data, err := registry.daemonConfig()
	if err != nil {
		t.Fatal(err)
	}
	var config buildkitConfig
	if err := toml.Unmarshal(data, &config); err != nil {
		t.Fatalf("decode %s: %v", data, err)
	}
	mirror := config.Registry[dockerHubRegistry]
	if len(mirror.Mirrors) != 1 || mirror.Mirrors[0] != testGateway+":5001"+dockerHubMirrorPath {
		t.Fatalf("docker.io mirrors = %v", mirror.Mirrors)
	}
	if !config.Registry[testGateway+":5001"].HTTP {
		t.Fatalf("insecure cache registry is not marked as HTTP: %s", data)
	}
	if worker := config.Worker[ociWorker]; !worker.GC || worker.MaxUsedSpace != builderMaxUsedSpace {
		t.Fatalf("BuildKit state is not bounded by garbage collection: %s", data)
	}
}

func TestImageFromOCIArchiveRejectsAnEmptyIndex(t *testing.T) {
	var archive bytes.Buffer
	writer := tar.NewWriter(&archive)
	layout := []byte(`{"imageLayoutVersion":"1.0.0"}`)
	index, err := json.Marshal(map[string]any{"schemaVersion": 2, "manifests": []any{}})
	if err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string][]byte{"oci-layout": layout, "index.json": index} {
		if err := writer.WriteHeader(&tar.Header{Name: name, Mode: 0o644, Size: int64(len(content)), Typeflag: tar.TypeReg}); err != nil {
			t.Fatal(err)
		}
		if _, err := writer.Write(content); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	output := filepath.Join(t.TempDir(), outputArchive)
	if err := os.WriteFile(output, archive.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}
	_, err = imageFromOCITar(output, filepath.Join(t.TempDir(), ociDirectory))
	if err == nil || !strings.Contains(err.Error(), "did not contain an image manifest") {
		t.Fatalf("imageFromOCITar() error = %v, want the empty-index error", err)
	}
}
