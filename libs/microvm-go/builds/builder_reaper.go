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
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"time"
)

type builderState struct {
	key      string
	lastUsed time.Time
}

func (pool *builderPool) run(ctx context.Context) {
	ticker := time.NewTicker(builderReapInterval)
	defer ticker.Stop()
	for {
		pool.stopIdle(ctx, pool.now().Add(-builderIdleTimeout))
		if err := pool.pruneStateDisks(); err != nil {
			slog.WarnContext(ctx, "could not prune organization builder state", "error", err)
		}
		select {
		case <-ctx.Done():
			pool.stopIdle(ctx, time.Time{})
			return
		case <-ticker.C:
		}
	}
}

func (pool *builderPool) stopIdle(ctx context.Context, usedBefore time.Time) {
	pool.mu.Lock()
	var idle []*warmBuilder
	for key, builder := range pool.builders {
		if builder.active > 0 || (!usedBefore.IsZero() && builder.lastUsed.After(usedBefore)) {
			continue
		}
		delete(pool.builders, key)
		idle = append(idle, builder)
	}
	pool.mu.Unlock()
	for _, builder := range idle {
		pool.stop(ctx, builder)
	}
}

func (pool *builderPool) pruneStateDisks() error {
	states, err := pool.listStates()
	if err != nil {
		return err
	}
	sort.Slice(states, func(left, right int) bool {
		return states[left].lastUsed.After(states[right].lastUsed)
	})
	cutoff := pool.now().Add(-builderStateRetention)
	pool.mu.Lock()
	defer pool.mu.Unlock()
	var removeErrors []error
	for index, state := range states {
		if _, warm := pool.builders[state.key]; warm {
			continue
		}
		if index < builderStateDiskLimit && state.lastUsed.After(cutoff) {
			continue
		}
		if err := os.RemoveAll(filepath.Dir(pool.paths.SystemBuilderState(state.key))); err != nil {
			removeErrors = append(removeErrors, fmt.Errorf("remove organization builder state %s: %w", state.key, err))
		}
	}
	return errors.Join(removeErrors...)
}

func (pool *builderPool) listStates() ([]builderState, error) {
	entries, err := os.ReadDir(pool.paths.SystemBuildersDir())
	if errors.Is(err, os.ErrNotExist) {
		return []builderState{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list organization builder state: %w", err)
	}
	states := make([]builderState, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		info, err := os.Stat(pool.paths.SystemBuilderState(entry.Name()))
		if errors.Is(err, os.ErrNotExist) {
			states = append(states, builderState{key: entry.Name()})
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("inspect organization builder state %s: %w", entry.Name(), err)
		}
		states = append(states, builderState{key: entry.Name(), lastUsed: info.ModTime()})
	}
	return states, nil
}
