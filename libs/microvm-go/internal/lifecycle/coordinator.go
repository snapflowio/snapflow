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

package lifecycle

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"

	"golang.org/x/sync/semaphore"
)

var ErrEmptyKey = errors.New("lifecycle lock key is required")

const maxReaders int64 = 1 << 30

type lockMode uint8

const (
	readLock lockMode = iota
	writeLock
)

type entry struct {
	semaphore  *semaphore.Weighted
	references int
}

type Coordinator struct {
	mu      sync.Mutex
	entries map[string]*entry
}

func NewCoordinator() *Coordinator {
	return &Coordinator{entries: make(map[string]*entry)}
}

type Guard struct {
	once    sync.Once
	release func()
}

func (g *Guard) Release() {
	if g == nil {
		return
	}
	g.once.Do(g.release)
}

func (c *Coordinator) ReadLock(ctx context.Context, key string) (*Guard, error) {
	return c.lockMany(ctx, readLock, key)
}

func (c *Coordinator) ReadLockMany(ctx context.Context, keys ...string) (*Guard, error) {
	return c.lockMany(ctx, readLock, keys...)
}

func (c *Coordinator) Lock(ctx context.Context, key string) (*Guard, error) {
	return c.lockMany(ctx, writeLock, key)
}

func (c *Coordinator) LockMany(ctx context.Context, keys ...string) (*Guard, error) {
	return c.lockMany(ctx, writeLock, keys...)
}

func (c *Coordinator) lockMany(ctx context.Context, mode lockMode, keys ...string) (*Guard, error) {
	normalized, err := normalizeKeys(keys)
	if err != nil {
		return nil, err
	}

	weight := int64(1)
	if mode == writeLock {
		weight = maxReaders
	}
	acquired := make([]string, 0, len(normalized))
	for _, key := range normalized {
		if err := c.acquire(ctx, key, weight); err != nil {
			for i := len(acquired) - 1; i >= 0; i-- {
				c.release(acquired[i], weight)
			}
			return nil, err
		}
		acquired = append(acquired, key)
	}

	return &Guard{release: func() {
		for i := len(acquired) - 1; i >= 0; i-- {
			c.release(acquired[i], weight)
		}
	}}, nil
}

func (c *Coordinator) acquire(ctx context.Context, key string, weight int64) error {
	c.mu.Lock()
	e, ok := c.entries[key]
	if !ok {
		e = &entry{semaphore: semaphore.NewWeighted(maxReaders)}
		c.entries[key] = e
	}
	e.references++
	c.mu.Unlock()

	if err := e.semaphore.Acquire(ctx, weight); err != nil {
		c.dropReference(key, e)
		return err
	}
	return nil
}

func (c *Coordinator) release(key string, weight int64) {
	c.mu.Lock()
	e, ok := c.entries[key]
	if !ok {
		c.mu.Unlock()
		return
	}
	e.semaphore.Release(weight)
	e.references--
	if e.references == 0 {
		delete(c.entries, key)
	}
	c.mu.Unlock()
}

func (c *Coordinator) dropReference(key string, expected *entry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	if !ok || e != expected {
		return
	}
	e.references--
	if e.references == 0 {
		delete(c.entries, key)
	}
}

func normalizeKeys(keys []string) ([]string, error) {
	unique := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		key = strings.TrimSpace(key)
		if key == "" {
			return nil, ErrEmptyKey
		}
		unique[key] = struct{}{}
	}
	if len(unique) == 0 {
		return nil, ErrEmptyKey
	}
	normalized := make([]string, 0, len(unique))
	for key := range unique {
		normalized = append(normalized, key)
	}
	sort.Strings(normalized)
	return normalized, nil
}
