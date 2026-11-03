// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
package buildcache

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/distribution/distribution/v3"
	"github.com/distribution/distribution/v3/configuration"
	"github.com/distribution/distribution/v3/manifest/ocischema"
	_ "github.com/distribution/distribution/v3/registry/storage/driver/filesystem"
	"github.com/distribution/reference"
	"github.com/opencontainers/go-digest"
	specs "github.com/opencontainers/image-spec/specs-go"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

const (
	layerMediaType   = "application/vnd.oci.image.layer.v1.tar"
	configMediaType  = "application/vnd.oci.image.config.v1+json"
	activeCache      = "transient/org-a/buildcache/0123456789abcdef"
	idleCache        = "transient/org-a/buildcache/fedcba9876543210"
	snapshotImage    = "transient/org-a/snapshot-image"
	ociSchemaVersion = 2
)

func sweepNow() time.Time {
	return time.Date(2026, 10, 18, 12, 0, 0, 0, time.UTC)
}

type fixture struct {
	root    string
	janitor *Janitor
	opened  store
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	root := t.TempDir()
	janitor, err := New(
		configuration.Storage{"filesystem": configuration.Parameters{"rootdirectory": root}},
		&sync.RWMutex{},
		WithClock(sweepNow),
	)
	if err != nil {
		t.Fatal(err)
	}
	opened, err := janitor.open(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	return fixture{root: root, janitor: janitor, opened: opened}
}

func (f fixture) repository(t *testing.T, name string) distribution.Repository {
	t.Helper()
	named, err := reference.WithName(name)
	if err != nil {
		t.Fatal(err)
	}
	repository, err := f.opened.registry.Repository(t.Context(), named)
	if err != nil {
		t.Fatal(err)
	}
	return repository
}

func (f fixture) pushImage(t *testing.T, name, tag string, layer []byte, usedAt time.Time) {
	t.Helper()
	repository := f.repository(t, name)
	blobs := repository.Blobs(t.Context())
	layerDescriptor, err := blobs.Put(t.Context(), layerMediaType, layer)
	if err != nil {
		t.Fatal(err)
	}
	config, err := json.Marshal(map[string]string{"layer": layerDescriptor.Digest.String()})
	if err != nil {
		t.Fatal(err)
	}
	configDescriptor, err := blobs.Put(t.Context(), configMediaType, config)
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := ocischema.FromStruct(ocischema.Manifest{
		Versioned: specs.Versioned{SchemaVersion: ociSchemaVersion},
		MediaType: v1.MediaTypeImageManifest,
		Config:    configDescriptor,
		Layers:    []v1.Descriptor{layerDescriptor},
	})
	if err != nil {
		t.Fatal(err)
	}
	manifests, err := repository.Manifests(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	manifestDigest, err := manifests.Put(t.Context(), manifest)
	if err != nil {
		t.Fatal(err)
	}
	if err := repository.Tags(t.Context()).Tag(t.Context(), tag, v1.Descriptor{Digest: manifestDigest}); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(f.root, "docker/registry/v2/repositories", name, "_manifests/tags", tag, "current/link")
	if err := os.Chtimes(link, usedAt, usedAt); err != nil {
		t.Fatal(err)
	}
}

func (f fixture) blobExists(t *testing.T, content []byte) bool {
	t.Helper()
	_, err := f.opened.registry.BlobStatter().Stat(t.Context(), digest.FromBytes(content))
	return err == nil
}

func (f fixture) cacheNames(t *testing.T) map[string]struct{} {
	t.Helper()
	caches, err := listCaches(t.Context(), f.opened)
	if err != nil {
		t.Fatal(err)
	}
	names := make(map[string]struct{}, len(caches))
	for _, cache := range caches {
		names[cache.repository] = struct{}{}
	}
	return names
}

func TestSweepRemovesIdleCachesAndOnlyTheirOrphanedBlobs(t *testing.T) {
	f := newFixture(t)
	activeLayer, idleLayer, sharedLayer := []byte("active layer"), []byte("idle layer"), []byte("shared layer")
	f.pushImage(t, activeCache, cacheTag, activeLayer, sweepNow().Add(-time.Hour))
	f.pushImage(t, idleCache, cacheTag, idleLayer, sweepNow().Add(-IdleRetention-time.Hour))
	f.pushImage(t, snapshotImage, "latest", sharedLayer, sweepNow().Add(-IdleRetention-time.Hour))
	f.pushImage(t, idleCache+"0", cacheTag, sharedLayer, sweepNow().Add(-IdleRetention-time.Hour))

	report, err := f.janitor.sweep(t.Context(), f.opened)
	if err != nil {
		t.Fatal(err)
	}
	if report.repositories != 2 {
		t.Fatalf("removed %d repositories, want 2", report.repositories)
	}
	names := f.cacheNames(t)
	if _, kept := names[activeCache]; !kept || len(names) != 1 {
		t.Fatalf("remaining caches = %v, want only %s", names, activeCache)
	}
	if !f.blobExists(t, activeLayer) {
		t.Fatal("sweep removed a blob of an active cache")
	}
	if f.blobExists(t, idleLayer) {
		t.Fatal("sweep kept a blob only an idle cache referenced")
	}
	if !f.blobExists(t, sharedLayer) {
		t.Fatal("sweep removed a blob another repository still links")
	}
}

func TestOrganizationBudgetEvictsLeastRecentlyUsedCaches(t *testing.T) {
	half := int64(OrganizationBudgetBytes / 2)
	shared := digest.FromString("shared")
	caches := []cacheEntry{
		{repository: "oldest", lastUsed: sweepNow().Add(-3 * time.Hour), blobs: map[digest.Digest]int64{digest.FromString("c"): half}},
		{repository: "newest", lastUsed: sweepNow().Add(-time.Hour), blobs: map[digest.Digest]int64{digest.FromString("a"): half, shared: 1}},
		{repository: "middle", lastUsed: sweepNow().Add(-2 * time.Hour), blobs: map[digest.Digest]int64{shared: 1}},
		{repository: "expired", lastUsed: sweepNow().Add(-IdleRetention - time.Minute), blobs: map[digest.Digest]int64{}},
	}
	candidates := organizationCandidates(caches, sweepNow())
	evicted := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		evicted[candidate.repository] = struct{}{}
	}
	for _, name := range []string{"oldest", "expired"} {
		if _, ok := evicted[name]; !ok {
			t.Fatalf("evicted = %v, want %s evicted", evicted, name)
		}
	}
	for _, name := range []string{"newest", "middle"} {
		if _, ok := evicted[name]; ok {
			t.Fatalf("evicted = %v, want %s retained", evicted, name)
		}
	}
}

func TestOrganizationBudgetKeepsTheMostRecentCache(t *testing.T) {
	caches := []cacheEntry{{
		repository: "huge", lastUsed: sweepNow(),
		blobs: map[digest.Digest]int64{digest.FromString("huge"): OrganizationBudgetBytes + 1},
	}}
	if candidates := organizationCandidates(caches, sweepNow()); len(candidates) != 0 {
		t.Fatalf("the most recent cache was evicted: %v", candidates)
	}
}

func TestCacheOrganizationAcceptsOnlyBuildCacheRepositories(t *testing.T) {
	for name, want := range map[string]bool{
		activeCache:                   true,
		snapshotImage:                 false,
		"transient/org-a/buildcache":  false,
		"other/org-a/buildcache/key":  false,
		"transient//buildcache/key":   false,
		"transient/org-a/buildcache/": false,
	} {
		if _, got := cacheOrganization(name); got != want {
			t.Fatalf("cacheOrganization(%q) = %t, want %t", name, got, want)
		}
	}
}
