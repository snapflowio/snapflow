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
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
	"golang.org/x/sync/singleflight"
)

func (c *Cache) PreparedSeed(ctx context.Context, keyID string, key Key, request types.CreateRequest) (string, error) {
	c.mu.Lock()
	reused := c.reuseLocked(ctx, keyID, key)
	c.mu.Unlock()
	if reused {
		return SeedID(keyID), nil
	}
	c.build(ctx, keyID, key, request)
	return "", ErrPreparing
}

func (c *Cache) Seed(ctx context.Context, keyID string, key Key, request types.CreateRequest) (string, error) {
	resultChannel := c.build(ctx, keyID, key, request)
	var result singleflight.Result
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case result = <-resultChannel:
	}
	if result.Err != nil {
		return "", result.Err
	}
	seedID, valid := result.Val.(string)
	if !valid || seedID == "" {
		return "", errors.New("runtime template builder returned an invalid seed identity")
	}
	if result.Shared {
		slog.DebugContext(ctx, "reused concurrent runtime template build", "template_key", keyID)
	}
	return seedID, nil
}

func (c *Cache) build(ctx context.Context, keyID string, key Key, request types.CreateRequest) <-chan singleflight.Result {
	return c.builds.DoChan(keyID, func() (any, error) {
		buildContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), buildTimeout)
		defer cancel()
		seedID, err := c.seedOnce(buildContext, keyID, key, request)
		if err != nil {
			slog.WarnContext(buildContext, "could not prepare runtime template", "template_key", keyID, "error", err)
		}
		return seedID, err
	})
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
	select {
	case c.buildSlots <- struct{}{}:
		defer func() { <-c.buildSlots }()
	case <-ctx.Done():
		return "", fmt.Errorf("wait for runtime template build slot: %w", ctx.Err())
	}
	if err := c.clearStaleSeed(ctx, seedID); err != nil {
		return "", err
	}
	built, err := c.buildSeed(ctx, request)
	if err != nil {
		return "", errors.Join(
			fmt.Errorf("record runtime template artifacts: %w", err),
			wrapOptionalError("clean up invalid template seed", c.seeds.DestroySeed(context.WithoutCancel(ctx), seedID)),
		)
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
		return "", errors.Join(
			fmt.Errorf("validate completed runtime template: %w", err),
			wrapOptionalError("clean up invalid completed template", c.seeds.DestroySeed(context.WithoutCancel(ctx), seedID)),
		)
	}
	if err := c.record(keyID, stored); err != nil {
		return "", errors.Join(err, wrapOptionalError("clean up unrecorded template seed", c.seeds.DestroySeed(context.WithoutCancel(ctx), seedID)))
	}
	if err := c.Prune(ctx, keyID); err != nil {
		slog.WarnContext(ctx, "could not prune runtime templates", "error", err)
	}
	return seedID, nil
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
	stored, err := c.loadManifest(keyID)
	switch {
	case err == nil:
		if refreshed, refreshErr := c.refreshStoredLocked(keyID, stored, key); refreshErr == nil {
			c.touchLocked(ctx, keyID, refreshed)
			return true
		}
		c.invalidateLocked(keyID)
	case !errors.Is(err, os.ErrNotExist):
		slog.WarnContext(ctx, "discarding unreadable runtime template manifest", "template_key", keyID, "error", err)
		c.invalidateLocked(keyID)
	}
	return false
}

func (c *Cache) touchLocked(ctx context.Context, keyID string, stored manifest) {
	now := time.Now().UTC()
	if !stored.LastUsedAt.IsZero() && now.Sub(stored.LastUsedAt) < usageTouchInterval {
		return
	}
	stored.LastUsedAt = now
	if err := c.writeManifest(keyID, stored); err != nil {
		slog.WarnContext(ctx, "could not update runtime template usage", "template_key", keyID, "error", err)
	}
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

func (c *Cache) buildSeed(ctx context.Context, request types.CreateRequest) (artifacts, error) {
	if err := c.seeds.BuildSeed(ctx, request); err != nil {
		return artifacts{}, err
	}
	if err := c.shareSnapshot(request.ID); err != nil {
		return artifacts{}, err
	}
	return c.captureArtifacts(request.ID)
}

func wrapOptionalError(message string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, err)
}
