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
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

const (
	removedTemplateKey  = "template-key"
	removedTemplateSeed = "template-seed"
	evictedTemplateKey  = "evicted-key"
	evictedTemplateSeed = "evicted-seed"
	templateMemoryBytes = 2 << 20
	templateDirPerm     = 0o755
)

type fakeSeeds struct {
	cache        *Cache
	destroyed    []string
	lockedDuring []string
}

func (seeds *fakeSeeds) BuildSeed(context.Context, types.CreateRequest) error {
	return errors.New("fake seeds do not boot guests")
}

func (seeds *fakeSeeds) DestroySeed(ctx context.Context, seedID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if !seeds.cache.mu.TryLock() {
		seeds.lockedDuring = append(seeds.lockedDuring, seedID)
	} else {
		seeds.cache.mu.Unlock()
	}
	seeds.destroyed = append(seeds.destroyed, seedID)
	return os.RemoveAll(seeds.cache.paths.InstanceDir(seedID))
}

func templateCache(t *testing.T) (*Cache, *fakeSeeds) {
	t.Helper()
	seeds := &fakeSeeds{}
	cache := New(Config{Paths: layout.NewPaths(t.TempDir())}, seeds)
	seeds.cache = cache
	writeStoredTemplate(t, cache, removedTemplateKey, manifest{SeedID: removedTemplateSeed})
	seedMemory := filepath.Join(cache.paths.InstanceDir(removedTemplateSeed), snapshotMemoryFile)
	if err := os.MkdirAll(filepath.Dir(seedMemory), templateDirPerm); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(seedMemory, make([]byte, templateMemoryBytes), templateFilePerm); err != nil {
		t.Fatal(err)
	}
	return cache, seeds
}

func writeStoredTemplate(t *testing.T, cache *Cache, keyID string, stored manifest) {
	t.Helper()
	if err := os.MkdirAll(cache.paths.SystemTemplate(keyID), templateDirPerm); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(stored)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(cache.paths.SystemTemplateManifest(keyID), encoded, templateFilePerm); err != nil {
		t.Fatal(err)
	}
}

func TestEvictLeastRecentlyUsedReclaimsTheOldestIdleTemplate(t *testing.T) {
	cache, seeds := templateCache(t)
	writeStoredTemplate(t, cache, evictedTemplateKey, manifest{SeedID: evictedTemplateSeed, LastUsedAt: time.Now().UTC()})

	evicted, err := cache.EvictLeastRecentlyUsed(context.Background())

	if err != nil || !evicted {
		t.Fatalf("EvictLeastRecentlyUsed() = %v, %v, want an eviction", evicted, err)
	}
	if len(seeds.destroyed) != 1 || seeds.destroyed[0] != removedTemplateSeed {
		t.Fatalf("destroyed seeds = %v, want [%s]", seeds.destroyed, removedTemplateSeed)
	}
	if _, err := os.Stat(cache.paths.SystemTemplateManifest(evictedTemplateKey)); err != nil {
		t.Fatalf("the recently used template was not kept: %v", err)
	}
	if len(seeds.lockedDuring) != 0 || len(cache.reclaiming) != 0 {
		t.Fatalf("eviction held the lock during %v or leaked reclaiming seeds %v", seeds.lockedDuring, cache.reclaiming)
	}
}

func TestEvictLeastRecentlyUsedSkipsATemplateWhoseSeedIsBuilding(t *testing.T) {
	cache, seeds := templateCache(t)
	cache.building[removedTemplateSeed] = struct{}{}

	evicted, err := cache.EvictLeastRecentlyUsed(context.Background())

	if err != nil || evicted {
		t.Fatalf("EvictLeastRecentlyUsed() = %v, %v, want no eviction", evicted, err)
	}
	if len(seeds.destroyed) != 0 {
		t.Fatalf("destroyed seeds %v of a template in use", seeds.destroyed)
	}
}

func TestRemoveReclaimsTheTemplateAndItsSeedOutsideTheLock(t *testing.T) {
	cache, seeds := templateCache(t)

	if err := cache.Remove(context.Background(), removedTemplateKey); err != nil {
		t.Fatalf("remove template: %v", err)
	}

	for _, path := range []string{cache.paths.SystemTemplate(removedTemplateKey), cache.paths.InstanceDir(removedTemplateSeed)} {
		if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("%s survived the template removal: %v", path, err)
		}
	}
	if len(seeds.lockedDuring) != 0 {
		t.Fatalf("seeds %v were destroyed while the template lock was held", seeds.lockedDuring)
	}
	if len(cache.reclaiming) != 0 {
		t.Fatalf("reclaimed seeds were not released: %v", cache.reclaiming)
	}
	if err := cache.Remove(context.Background(), removedTemplateKey); err != nil {
		t.Fatalf("remove an absent template: %v", err)
	}
}

func TestRemoveKeepsATemplateWhoseSeedIsBuilding(t *testing.T) {
	cache, seeds := templateCache(t)
	cache.building[removedTemplateSeed] = struct{}{}

	err := cache.Remove(context.Background(), removedTemplateKey)

	if !errors.Is(err, ErrInUse) {
		t.Fatalf("removed a template whose seed is building: %v", err)
	}
	if _, err := os.Stat(cache.paths.SystemTemplateManifest(removedTemplateKey)); err != nil {
		t.Fatalf("the template in use was not kept: %v", err)
	}
	if len(seeds.destroyed) != 0 {
		t.Fatalf("destroyed seeds %v of a template in use", seeds.destroyed)
	}
}

func TestRemoveRejectsAPathKey(t *testing.T) {
	cache, seeds := templateCache(t)

	if err := cache.Remove(context.Background(), filepath.Join("..", removedTemplateKey)); err == nil {
		t.Fatal("removed a template outside the template directory")
	}
	if len(seeds.destroyed) != 0 {
		t.Fatalf("destroyed seeds %v for an invalid key", seeds.destroyed)
	}
}

func TestPreparedKeysDiscardsAnInvalidTemplateInsteadOfFailing(t *testing.T) {
	cache, seeds := templateCache(t)
	cache.cloneAvailable = true
	keys, err := cache.PreparedKeys(context.Background())
	if err != nil {
		t.Fatalf("an invalid template failed the capability report: %v", err)
	}
	if len(keys) != 0 {
		t.Fatalf("prepared template keys = %v, want none", keys)
	}
	if _, err := os.Stat(cache.paths.SystemTemplate(removedTemplateKey)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("the invalid template was kept: %v", err)
	}
	if len(seeds.destroyed) != 1 || seeds.destroyed[0] != removedTemplateSeed {
		t.Fatalf("destroyed seeds = %v, want [%s]", seeds.destroyed, removedTemplateSeed)
	}
}

func TestOverLimitEvictionRemovesTheLeastRecentlyUsedTemplate(t *testing.T) {
	cache, seeds := templateCache(t)
	cache.cacheEntries = 1
	if err := os.MkdirAll(cache.paths.SystemTemplate(evictedTemplateKey), templateDirPerm); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	templates := []storedTemplate{
		{keyID: removedTemplateKey, manifest: manifest{SeedID: removedTemplateSeed, LastUsedAt: now}},
		{keyID: evictedTemplateKey, manifest: manifest{SeedID: evictedTemplateSeed, LastUsedAt: now.Add(-time.Hour)}},
	}
	planned := eviction{}
	cache.mu.Lock()
	cache.planOverLimitLocked(&planned, templates, "")
	cache.mu.Unlock()
	if err := errors.Join(planned.errors...); err != nil {
		t.Fatalf("eviction plan failed: %v", err)
	}
	if len(planned.seeds) != 1 || planned.seeds[0] != evictedTemplateSeed {
		t.Fatalf("evicted seeds = %v, want [%s]", planned.seeds, evictedTemplateSeed)
	}
	if _, err := os.Stat(cache.paths.SystemTemplate(evictedTemplateKey)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("the evicted template manifest was kept: %v", err)
	}
	if err := cache.reclaim(context.Background(), planned.seeds); err != nil {
		t.Fatal(err)
	}
	if len(seeds.lockedDuring) != 0 || len(cache.reclaiming) != 0 {
		t.Fatalf("eviction held the lock during %v or leaked reclaiming seeds %v", seeds.lockedDuring, cache.reclaiming)
	}
}
