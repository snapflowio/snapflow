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
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
)

const (
	reasonUnreadable   = "unreadable"
	reasonInvalid      = "invalid"
	reasonSuperseded   = "superseded"
	reasonReleased     = "released"
	reasonExpired      = "expired"
	reasonOverLimit    = "over_limit"
	reasonDiskPressure = "disk_pressure"
)

type eviction struct {
	seeds   []string
	settled []string
	errors  []error
}

func (e *eviction) fail(err error) {
	e.errors = append(e.errors, err)
}

func (c *Cache) Collections() <-chan struct{} {
	return c.collections
}

func (c *Cache) CollectionInterval() time.Duration {
	return min(maximumCollectionInterval, c.maxUnusedAge/collectionsPerUnusedAge)
}

func (c *Cache) requestCollection() {
	select {
	case c.collections <- struct{}{}:
	default:
	}
}

func (c *Cache) Collect(ctx context.Context) error {
	superseded, supersessionErr := c.supersededKeys(ctx)
	view := c.retentionView()
	c.mu.Lock()
	planned := c.planCollectionLocked(view, superseded, time.Now().UTC())
	c.mu.Unlock()
	return c.finish(ctx, planned, supersessionErr)
}

func (c *Cache) EvictLeastRecentlyUsed(ctx context.Context) (bool, error) {
	view := c.retentionView()
	c.mu.Lock()
	planned := eviction{}
	templates, _, err := c.listStoredLocked()
	if err != nil {
		c.mu.Unlock()
		return false, err
	}
	sortCollectionOrder(templates, view)
	for _, candidate := range templates {
		if c.evictLocked(&planned, candidate, reasonDiskPressure) {
			break
		}
	}
	c.mu.Unlock()
	return len(planned.seeds) > 0, c.finish(ctx, planned, nil)
}

func (c *Cache) finish(ctx context.Context, planned eviction, causes ...error) error {
	reclaimErr := c.reclaim(ctx, planned.seeds)
	c.settleReleased(planned.settled)
	return errors.Join(append(append(planned.errors, causes...), reclaimErr)...)
}

func (c *Cache) supersededKeys(ctx context.Context) (map[string]struct{}, error) {
	c.mu.RLock()
	templates, _, err := c.listStoredLocked()
	c.mu.RUnlock()
	if err != nil {
		return nil, err
	}
	superseded := make(map[string]struct{})
	var identifyErrors []error
	for _, stored := range templates {
		if err := ctx.Err(); err != nil {
			return superseded, err
		}
		current, err := c.currentKeyID(ctx, stored)
		if err != nil {
			identifyErrors = append(identifyErrors, fmt.Errorf("identify the current runtime template for %s: %w", stored.keyID, err))
			continue
		}
		if current != stored.keyID {
			superseded[stored.keyID] = struct{}{}
		}
	}
	return superseded, errors.Join(identifyErrors...)
}

func (c *Cache) currentKeyID(ctx context.Context, stored storedTemplate) (string, error) {
	metadata, err := state.ReadInstanceMetadata(c.paths, stored.manifest.SeedID)
	if errors.Is(err, os.ErrNotExist) {
		return stored.keyID, nil
	}
	if err != nil {
		return "", err
	}
	current, err := c.seeds.CurrentKey(ctx, stored.manifest.Key, metadata.RawRequest)
	if err != nil {
		return "", err
	}
	return KeyID(current)
}

func (c *Cache) planCollectionLocked(view retentionView, superseded map[string]struct{}, now time.Time) eviction {
	planned := eviction{}
	templates, err := c.validTemplatesLocked(&planned)
	if err != nil {
		planned.fail(err)
		return planned
	}
	present := make(map[string]struct{}, len(templates))
	kept := make([]storedTemplate, 0, len(templates))
	for _, candidate := range templates {
		present[candidate.keyID] = struct{}{}
		reason, collectible := c.collectionReason(candidate, view, superseded, now)
		if collectible && c.evictLocked(&planned, candidate, reason) {
			continue
		}
		kept = append(kept, candidate)
	}
	for keyID := range view.released {
		if _, found := present[keyID]; !found {
			planned.settled = append(planned.settled, keyID)
		}
	}
	if err := c.planOrphanSeedsLocked(&planned, kept); err != nil {
		planned.fail(err)
		return planned
	}
	c.planOverLimitLocked(&planned, kept, view)
	return planned
}

func (c *Cache) collectionReason(
	candidate storedTemplate,
	view retentionView,
	superseded map[string]struct{},
	now time.Time,
) (string, bool) {
	if _, found := superseded[candidate.keyID]; found {
		return reasonSuperseded, true
	}
	if view.releases(candidate.keyID) {
		return reasonReleased, true
	}
	if view.synced && !view.retains(candidate.keyID) && now.Sub(candidate.manifest.lastUsed()) > c.maxUnusedAge {
		return reasonExpired, true
	}
	return "", false
}

func (c *Cache) validTemplatesLocked(planned *eviction) ([]storedTemplate, error) {
	stored, unreadable, err := c.listStoredLocked()
	if err != nil {
		return nil, err
	}
	for _, keyID := range unreadable {
		c.discardLocked(planned, keyID, reasonUnreadable)
	}
	templates := make([]storedTemplate, 0, len(stored))
	for _, candidate := range stored {
		refreshed, err := c.refreshStoredLocked(candidate.keyID, candidate.manifest, candidate.manifest.Key)
		if err != nil {
			c.discardLocked(planned, candidate.keyID, reasonInvalid)
			continue
		}
		templates = append(templates, storedTemplate{keyID: candidate.keyID, manifest: refreshed})
	}
	return templates, nil
}

func (c *Cache) discardLocked(planned *eviction, keyID, reason string) {
	if err := os.RemoveAll(c.paths.SystemTemplate(keyID)); err != nil {
		planned.fail(fmt.Errorf("remove %s runtime template %s: %w", reason, keyID, err))
		return
	}
	slog.Info("collected runtime template", "template_key", keyID, "reason", reason)
	planned.settled = append(planned.settled, keyID)
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
		slog.Info("collected runtime template seed without a manifest", "seed_id", instance.ID, "state", instance.State)
		c.reclaiming[instance.ID] = struct{}{}
		planned.seeds = append(planned.seeds, instance.ID)
	}
	return nil
}

func (c *Cache) planOverLimitLocked(planned *eviction, templates []storedTemplate, view retentionView) {
	totalBytes := int64(0)
	for _, stored := range templates {
		totalBytes += stored.manifest.logicalBytes()
	}
	excessEntries := max(0, len(templates)-c.cacheEntries)
	if excessEntries == 0 && totalBytes <= c.cacheBytes {
		return
	}
	sortCollectionOrder(templates, view)
	for _, candidate := range templates {
		if excessEntries == 0 && totalBytes <= c.cacheBytes {
			break
		}
		if !c.evictLocked(planned, candidate, reasonOverLimit) {
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

func (c *Cache) evictLocked(planned *eviction, candidate storedTemplate, reason string) bool {
	seedID := candidate.manifest.SeedID
	if _, building := c.building[seedID]; building {
		return false
	}
	if err := os.RemoveAll(c.paths.SystemTemplate(candidate.keyID)); err != nil {
		planned.fail(fmt.Errorf("remove runtime template manifest %s: %w", candidate.keyID, err))
		return false
	}
	slog.Info(
		"collected runtime template",
		"template_key", candidate.keyID,
		"reason", reason,
		"last_used", candidate.manifest.lastUsed(),
	)
	c.reclaiming[seedID] = struct{}{}
	planned.seeds = append(planned.seeds, seedID)
	planned.settled = append(planned.settled, candidate.keyID)
	return true
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

func sortCollectionOrder(templates []storedTemplate, view retentionView) {
	sort.SliceStable(templates, func(left, right int) bool {
		leftRetained, rightRetained := view.retains(templates[left].keyID), view.retains(templates[right].keyID)
		if leftRetained != rightRetained {
			return rightRetained
		}
		return templates[left].manifest.lastUsed().Before(templates[right].manifest.lastUsed())
	})
}

func (c *Cache) remove(ctx context.Context, keyID string) error {
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
	delete(c.queue, keyID)
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

func (c *Cache) PreparedKeys(ctx context.Context) ([]string, error) {
	if !c.Eligible() {
		return []string{}, nil
	}
	keys, invalid, err := c.listPrepared(ctx)
	if err != nil {
		return nil, err
	}
	for _, keyID := range invalid {
		if removeErr := c.remove(ctx, keyID); removeErr != nil {
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
		if removeErr := c.remove(ctx, keyID); removeErr != nil {
			slog.WarnContext(ctx, "could not remove unverified runtime template", "template_key", keyID, "error", removeErr)
		}
	}
}

func (c *Cache) verifyStored(keyID string) error {
	stored, err := c.storedManifest(keyID)
	if err != nil {
		return err
	}
	return c.validateSeed(stored, stored.Key, verifyArtifactContent)
}

func (c *Cache) storedManifest(keyID string) (manifest, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.loadManifest(keyID)
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
