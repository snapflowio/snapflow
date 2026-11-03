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
	"sync"
	"sync/atomic"
	"time"

	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
	"golang.org/x/sync/singleflight"
)

const (
	defaultCacheEntries     = 32
	defaultCacheBytes       = 64 * 1024 * 1024 * 1024
	defaultBuildConcurrency = 2
	buildTimeout            = 5 * time.Minute
	usageTouchInterval      = 5 * time.Minute
)

var (
	ErrInUse      = errors.New("runtime template is in use")
	ErrReclaiming = errors.New("runtime template seed is being reclaimed")
	ErrPreparing  = errors.New("runtime template is being prepared")
)

type Seeds interface {
	BuildSeed(ctx context.Context, request types.CreateRequest) error
	DestroySeed(ctx context.Context, seedID string) error
}

type Config struct {
	Paths          layout.Paths
	CacheEntries   int
	CacheBytes     int64
	BuildLimit     int
	CloneAvailable bool
}

type Cache struct {
	paths            layout.Paths
	seeds            Seeds
	cacheEntries     int
	cacheBytes       int64
	builds           singleflight.Group
	buildSlots       chan struct{}
	mu               sync.RWMutex
	building         map[string]struct{}
	reclaiming       map[string]struct{}
	digests          sync.Map
	cloneAvailable   bool
	cloneUnavailable atomic.Bool
	fingerprint      HostFingerprint
	fingerprintErr   error
}

func New(cfg Config, seeds Seeds) *Cache {
	fingerprint, fingerprintErr := readHostFingerprint()
	return &Cache{
		paths:          cfg.Paths,
		seeds:          seeds,
		cacheEntries:   positiveOr(cfg.CacheEntries, defaultCacheEntries),
		cacheBytes:     positiveOr(cfg.CacheBytes, defaultCacheBytes),
		buildSlots:     make(chan struct{}, positiveOr(cfg.BuildLimit, defaultBuildConcurrency)),
		building:       make(map[string]struct{}),
		reclaiming:     make(map[string]struct{}),
		cloneAvailable: cfg.CloneAvailable,
		fingerprint:    fingerprint,
		fingerprintErr: fingerprintErr,
	}
}

func positiveOr[T int | int64](value, defaultValue T) T {
	if value > 0 {
		return value
	}
	return defaultValue
}

func (c *Cache) Eligible() bool {
	return c.cloneAvailable && !c.cloneUnavailable.Load()
}

func (c *Cache) MarkCloneUnavailable() {
	c.cloneUnavailable.Store(true)
}

func (c *Cache) HostFingerprint() (HostFingerprint, error) {
	return c.fingerprint, c.fingerprintErr
}

func (c *Cache) Pin(keyID string, key Key) (func(), error) {
	c.mu.RLock()
	manifest, err := c.loadManifest(keyID)
	if err == nil {
		err = c.validateSeed(manifest, key, verifyArtifactIdentity)
	}
	if err != nil {
		c.mu.RUnlock()
		return nil, err
	}
	return c.mu.RUnlock, nil
}

func (c *Cache) Invalidate(keyID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.invalidateLocked(keyID)
}
