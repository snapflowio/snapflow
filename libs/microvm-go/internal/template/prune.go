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
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"

	"github.com/snapflowio/microvm-go/internal/state"
)

type eviction struct {
	seeds  []string
	errors []error
}

func (e *eviction) fail(err error) {
	e.errors = append(e.errors, err)
}

func (c *Cache) Prune(ctx context.Context, retainedKeyID string) error {
	c.mu.Lock()
	planned := c.planEvictionLocked(retainedKeyID)
	c.mu.Unlock()
	return errors.Join(append(planned.errors, c.reclaim(ctx, planned.seeds))...)
}

func (c *Cache) Remove(ctx context.Context, keyID string) error {
	if keyID == "" || filepath.Base(keyID) != keyID {
		return fmt.Errorf("runtime template key %q is invalid", keyID)
	}
	seedID, removed, err := c.removeManifest(keyID)
	if err != nil || !removed {
		return err
	}
	return c.reclaim(ctx, []string{seedID})
}

func (c *Cache) removeManifest(keyID string) (string, bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	stored, err := c.loadManifest(keyID)
	if errors.Is(err, os.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("load runtime template %s: %w", keyID, err)
	}
	if _, building := c.building[stored.SeedID]; building {
		return "", false, fmt.Errorf("remove runtime template %s: %w", keyID, ErrInUse)
	}
	if err := os.RemoveAll(c.paths.SystemTemplate(keyID)); err != nil {
		return "", false, fmt.Errorf("remove runtime template %s: %w", keyID, err)
	}
	c.reclaiming[stored.SeedID] = struct{}{}
	return stored.SeedID, true, nil
}

func (c *Cache) reclaim(ctx context.Context, seedIDs []string) error {
	var reclaimErrors []error
	for _, seedID := range seedIDs {
		if err := c.seeds.DestroySeed(ctx, seedID); err != nil {
			reclaimErrors = append(reclaimErrors, fmt.Errorf("destroy runtime template seed %s: %w", seedID, err))
		}
		c.mu.Lock()
		delete(c.reclaiming, seedID)
		c.mu.Unlock()
	}
	return errors.Join(reclaimErrors...)
}

func (c *Cache) planEvictionLocked(retainedKeyID string) eviction {
	planned := eviction{}
	stored, unreadable, err := c.listStoredLocked()
	if err != nil {
		planned.fail(err)
		return planned
	}
	for _, keyID := range unreadable {
		c.discardLocked(&planned, keyID, "unreadable")
	}
	templates := make([]storedTemplate, 0, len(stored))
	for _, candidate := range stored {
		refreshed, err := c.refreshStoredLocked(candidate.keyID, candidate.manifest, candidate.manifest.Key)
		if err != nil {
			c.discardLocked(&planned, candidate.keyID, "invalid")
			continue
		}
		templates = append(templates, storedTemplate{keyID: candidate.keyID, manifest: refreshed})
	}
	if err := c.planOrphanSeedsLocked(&planned, templates); err != nil {
		planned.fail(err)
		return planned
	}
	c.planOverLimitLocked(&planned, templates, retainedKeyID)
	return planned
}

func (c *Cache) discardLocked(planned *eviction, keyID, reason string) {
	if err := os.RemoveAll(c.paths.SystemTemplate(keyID)); err != nil {
		planned.fail(fmt.Errorf("remove %s runtime template %s: %w", reason, keyID, err))
	}
}

func (c *Cache) planOrphanSeedsLocked(planned *eviction, templates []storedTemplate) error {
	instances, err := state.ListInstanceMetadata(c.paths)
	if err != nil {
		return fmt.Errorf("inspect runtime template dependencies: %w", err)
	}
	referenced := make(map[string]struct{}, len(templates))
	for _, stored := range templates {
		referenced[stored.manifest.SeedID] = struct{}{}
	}
	for _, instance := range instances {
		if !instance.TemplateSeed {
			continue
		}
		_, building := c.building[instance.ID]
		_, reclaiming := c.reclaiming[instance.ID]
		_, isReferenced := referenced[instance.ID]
		if building || reclaiming || isReferenced {
			continue
		}
		c.reclaiming[instance.ID] = struct{}{}
		planned.seeds = append(planned.seeds, instance.ID)
	}
	return nil
}

func (c *Cache) planOverLimitLocked(planned *eviction, templates []storedTemplate, retainedKeyID string) {
	totalBytes := int64(0)
	for _, stored := range templates {
		totalBytes += stored.manifest.logicalBytes()
	}
	excessEntries := max(0, len(templates)-c.cacheEntries)
	if excessEntries == 0 && totalBytes <= c.cacheBytes {
		return
	}
	sortLeastRecentlyUsed(templates)
	for _, candidate := range templates {
		if excessEntries == 0 && totalBytes <= c.cacheBytes {
			break
		}
		if candidate.keyID == retainedKeyID || !c.evictLocked(planned, candidate) {
			continue
		}
		excessEntries = max(0, excessEntries-1)
		totalBytes -= candidate.manifest.logicalBytes()
	}
	if excessEntries > 0 {
		planned.fail(fmt.Errorf("runtime template cache remains %d entries over its limit", excessEntries))
	}
	if totalBytes > c.cacheBytes {
		planned.fail(fmt.Errorf("runtime template cache remains %d bytes over its limit", totalBytes-c.cacheBytes))
	}
}

func (c *Cache) EvictLeastRecentlyUsed(ctx context.Context) (bool, error) {
	c.mu.Lock()
	planned := eviction{}
	templates, _, err := c.listStoredLocked()
	if err != nil {
		c.mu.Unlock()
		return false, err
	}
	sortLeastRecentlyUsed(templates)
	for _, candidate := range templates {
		if c.evictLocked(&planned, candidate) {
			break
		}
	}
	c.mu.Unlock()
	return len(planned.seeds) > 0, errors.Join(append(planned.errors, c.reclaim(ctx, planned.seeds))...)
}

func (c *Cache) evictLocked(planned *eviction, candidate storedTemplate) bool {
	seedID := candidate.manifest.SeedID
	if _, building := c.building[seedID]; building {
		return false
	}
	if err := os.RemoveAll(c.paths.SystemTemplate(candidate.keyID)); err != nil {
		planned.fail(fmt.Errorf("remove runtime template manifest %s: %w", candidate.keyID, err))
		return false
	}
	c.reclaiming[seedID] = struct{}{}
	planned.seeds = append(planned.seeds, seedID)
	return true
}

func sortLeastRecentlyUsed(templates []storedTemplate) {
	sort.Slice(templates, func(left, right int) bool {
		return templates[left].manifest.lastUsed().Before(templates[right].manifest.lastUsed())
	})
}

func (c *Cache) PreparedKeys(ctx context.Context) ([]string, error) {
	if !c.Eligible() {
		return []string{}, nil
	}
	keys, invalid, err := c.listPrepared(ctx)
	if err != nil {
		return nil, err
	}
	for _, keyID := range invalid {
		if removeErr := c.Remove(ctx, keyID); removeErr != nil {
			slog.WarnContext(ctx, "could not discard invalid runtime template", "template_key", keyID, "error", removeErr)
		}
	}
	return keys, nil
}

func (c *Cache) listPrepared(ctx context.Context) ([]string, []string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entries, err := os.ReadDir(c.paths.SystemTemplatesDir())
	if errors.Is(err, os.ErrNotExist) {
		return []string{}, []string{}, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("list prepared runtime templates: %w", err)
	}
	keys := make([]string, 0, len(entries))
	var invalid []string
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return nil, nil, err
		}
		if !entry.IsDir() {
			continue
		}
		if err := c.validatePrepared(entry.Name()); err != nil {
			slog.WarnContext(ctx, "discarding invalid runtime template", "template_key", entry.Name(), "error", err)
			invalid = append(invalid, entry.Name())
			continue
		}
		keys = append(keys, entry.Name())
	}
	sort.Strings(keys)
	return keys, invalid, nil
}

func (c *Cache) validatePrepared(directory string) error {
	stored, err := c.loadManifest(directory)
	if err != nil {
		return fmt.Errorf("load prepared runtime template: %w", err)
	}
	keyID, err := KeyID(stored.Key)
	if err != nil {
		return fmt.Errorf("identify prepared runtime template: %w", err)
	}
	if keyID != directory {
		return fmt.Errorf("prepared runtime template directory does not match manifest key %s", keyID)
	}
	return c.validateSeed(stored, stored.Key, verifyArtifactIdentity)
}

func (c *Cache) VerifyStored(ctx context.Context) {
	keys, err := c.keysByRecentUse()
	if err != nil {
		slog.WarnContext(ctx, "could not list runtime templates for content verification", "error", err)
		return
	}
	for _, keyID := range keys {
		if ctx.Err() != nil {
			return
		}
		verifyErr := c.verifyStored(keyID)
		if verifyErr == nil || errors.Is(verifyErr, os.ErrNotExist) {
			continue
		}
		slog.WarnContext(ctx, "removing runtime template that failed content verification", "template_key", keyID, "error", verifyErr)
		if removeErr := c.Remove(ctx, keyID); removeErr != nil {
			slog.WarnContext(ctx, "could not remove unverified runtime template", "template_key", keyID, "error", removeErr)
		}
	}
}

func (c *Cache) verifyStored(keyID string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	stored, err := c.loadManifest(keyID)
	if err != nil {
		return err
	}
	return c.validateSeed(stored, stored.Key, verifyArtifactContent)
}

func (c *Cache) keysByRecentUse() ([]string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	templates, _, err := c.listStoredLocked()
	if err != nil {
		return nil, err
	}
	sort.Slice(templates, func(left, right int) bool {
		return templates[left].manifest.lastUsed().After(templates[right].manifest.lastUsed())
	})
	keys := make([]string, len(templates))
	for index, stored := range templates {
		keys[index] = stored.keyID
	}
	return keys, nil
}
