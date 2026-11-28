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
	"maps"
	"os"
	"slices"
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
	"golang.org/x/sync/singleflight"
)

type queuedSeed struct {
	key     Key
	request types.CreateRequest
	reason  string
}

func (c *Cache) PreparedSeed(ctx context.Context, keyID string, key Key) (string, error) {
	c.mu.Lock()
	reused := c.reuseLocked(ctx, keyID, key)
	c.mu.Unlock()
	if reused {
		return SeedID(keyID), nil
	}
	return "", ErrNotPrepared
}

func (c *Cache) Prepare(ctx context.Context, keyID string, key Key, request types.CreateRequest) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.preparedLocked(ctx, keyID, key) {
		return
	}
	c.enqueueLocked(ctx, keyID, queuedSeed{key: key, request: request})
}

func (c *Cache) Queued() <-chan struct{} {
	return c.queued
}

func (c *Cache) BuildQueued(ctx context.Context, ready func(types.CreateRequest) error) {
	for ctx.Err() == nil {
		keyID, seed, found := c.nextReady(ctx, ready)
		if !found {
			return
		}
		if result := <-c.build(ctx, keyID, seed.key, seed.request); result.Err != nil {
			return
		}
	}
}

func (c *Cache) nextReady(ctx context.Context, ready func(types.CreateRequest) error) (string, queuedSeed, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	keys := slices.Sorted(maps.Keys(c.queue))
	for _, keyID := range keys {
		seed := c.queue[keyID]
		if err := ready(seed.request); err != nil {
			c.deferLocked(ctx, keyID, seed, err)
			continue
		}
		delete(c.queue, keyID)
		return keyID, seed, true
	}
	return "", queuedSeed{}, false
}

func (c *Cache) enqueueLocked(ctx context.Context, keyID string, seed queuedSeed) {
	if _, queued := c.queue[keyID]; !queued {
		slog.DebugContext(ctx, "runtime template seed queued", "template_key", keyID)
	}
	c.queue[keyID] = seed
	select {
	case c.queued <- struct{}{}:
	default:
	}
}

func (c *Cache) deferLocked(ctx context.Context, keyID string, seed queuedSeed, cause error) {
	if seed.reason != cause.Error() {
		slog.DebugContext(ctx, "runtime template seed deferred", "template_key", keyID, "reason", cause)
	}
	seed.reason = cause.Error()
	c.queue[keyID] = seed
}

func (c *Cache) build(ctx context.Context, keyID string, key Key, request types.CreateRequest) <-chan singleflight.Result {
	return c.builds.DoChan(keyID, func() (any, error) {
		buildContext, cancel := context.WithTimeout(ctx, buildTimeout)
		defer cancel()
		seedID, err := c.seedOnce(buildContext, keyID, key, request)
		c.recordOutcome(buildContext, keyID, key, request, err)
		return seedID, err
	})
}

func (c *Cache) recordOutcome(ctx context.Context, keyID string, key Key, request types.CreateRequest, err error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !errors.Is(err, ErrDeferred) {
		delete(c.queue, keyID)
		if err != nil {
			slog.WarnContext(ctx, "could not prepare runtime template", "template_key", keyID, "error", err)
		}
		return
	}
	c.deferLocked(ctx, keyID, queuedSeed{key: key, request: request}, err)
	c.enqueueLocked(ctx, keyID, c.queue[keyID])
}

func (c *Cache) seedOnce(ctx context.Context, keyID string, key Key, request types.CreateRequest) (string, error) {
	seedID := SeedID(keyID)
	if request.ID != seedID {
		return "", fmt.Errorf("template seed request %s does not match seed identity %s", request.ID, seedID)
	}
	reused, err := c.reuseOrReserve(ctx, keyID, key)
	if err != nil || reused {
		return seedID, err
	}
	defer c.release(seedID)
	startedAt := time.Now()
	select {
	case c.buildSlots <- struct{}{}:
		defer func() { <-c.buildSlots }()
	case <-ctx.Done():
		return "", fmt.Errorf("wait for runtime template build slot: %w", ctx.Err())
	}
	if err := c.clearStaleSeed(ctx, seedID); err != nil {
		return "", err
	}
	if err := c.seeds.BuildSeed(ctx, request); err != nil {
		return "", err
	}
	if err := c.recordSeed(ctx, keyID, key, seedID); err != nil {
		return "", err
	}
	slog.InfoContext(ctx, "runtime template prepared", "template_key", keyID, "build_ms", time.Since(startedAt).Milliseconds())
	return seedID, nil
}

func (c *Cache) recordSeed(ctx context.Context, keyID string, key Key, seedID string) (returnErr error) {
	recorded := false
	defer func() {
		if !recorded {
			returnErr = errors.Join(returnErr, wrapOptionalError("discard unrecorded template seed", c.seeds.DestroySeed(context.WithoutCancel(ctx), seedID)))
		}
	}()
	built, err := c.captureSeed(seedID)
	if err != nil {
		return fmt.Errorf("record runtime template artifacts: %w", err)
	}
	now := time.Now().UTC()
	stored := manifest{
		SchemaVersion: manifestSchemaVersion,
		Key:           key,
		SeedID:        seedID,
		Artifacts:     built,
		CreatedAt:     now,
		LastUsedAt:    now,
	}
	if err := c.validateSeed(stored, key, verifyArtifactIdentity); err != nil {
		c.Invalidate(keyID)
		return fmt.Errorf("validate completed runtime template: %w", err)
	}
	if err := c.record(keyID, stored); err != nil {
		return err
	}
	recorded = true
	c.requestCollection()
	return nil
}

func (c *Cache) reuseOrReserve(ctx context.Context, keyID string, key Key) (bool, error) {
	seedID := SeedID(keyID)
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.reuseLocked(ctx, keyID, key) {
		return true, nil
	}
	if _, reclaiming := c.reclaiming[seedID]; reclaiming {
		return false, ErrReclaiming
	}
	c.building[seedID] = struct{}{}
	return false, nil
}

func (c *Cache) reuseLocked(ctx context.Context, keyID string, key Key) bool {
	stored, prepared := c.storedLocked(ctx, keyID, key)
	if prepared {
		c.touchLocked(ctx, keyID, stored)
	}
	return prepared
}

func (c *Cache) preparedLocked(ctx context.Context, keyID string, key Key) bool {
	_, prepared := c.storedLocked(ctx, keyID, key)
	return prepared
}

func (c *Cache) storedLocked(ctx context.Context, keyID string, key Key) (manifest, bool) {
	stored, err := c.loadManifest(keyID)
	switch {
	case err == nil:
		if refreshed, refreshErr := c.refreshStoredLocked(keyID, stored, key); refreshErr == nil {
			return refreshed, true
		}
		c.invalidateLocked(keyID)
	case !errors.Is(err, os.ErrNotExist):
		slog.WarnContext(ctx, "discarding unreadable runtime template manifest", "template_key", keyID, "error", err)
		c.invalidateLocked(keyID)
	}
	return manifest{}, false
}

func (c *Cache) touchLocked(ctx context.Context, keyID string, stored manifest) {
	now := time.Now().UTC()
	if !stored.LastUsedAt.IsZero() && now.Sub(stored.LastUsedAt) < c.touchInterval() {
		return
	}
	stored.LastUsedAt = now
	if err := c.writeManifest(keyID, stored); err != nil {
		slog.WarnContext(ctx, "could not update runtime template usage", "template_key", keyID, "error", err)
	}
}

func (c *Cache) touchInterval() time.Duration {
	return min(usageTouchInterval, c.maxUnusedAge/touchesPerUnusedAge)
}

func (c *Cache) release(seedID string) {
	c.mu.Lock()
	delete(c.building, seedID)
	c.mu.Unlock()
}

func (c *Cache) record(keyID string, stored manifest) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.writeManifest(keyID, stored)
}

func (c *Cache) clearStaleSeed(ctx context.Context, seedID string) error {
	existing, err := state.ReadInstanceMetadata(c.paths, seedID)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("inspect template seed: %w", err)
	}
	if !existing.TemplateSeed {
		return fmt.Errorf("template seed identifier collides with runtime %s", seedID)
	}
	if err := c.seeds.DestroySeed(ctx, seedID); err != nil {
		return fmt.Errorf("remove incompatible template seed: %w", err)
	}
	return nil
}

func (c *Cache) captureSeed(seedID string) (artifacts, error) {
	if err := c.shareSnapshot(seedID); err != nil {
		return artifacts{}, err
	}
	return c.captureArtifacts(seedID)
}

func wrapOptionalError(message string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, err)
}
