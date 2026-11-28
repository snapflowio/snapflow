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
	"maps"
	"sync"
)

type retention struct {
	mu       sync.Mutex
	synced   bool
	retained map[string]struct{}
	released map[string]struct{}
}

type retentionView struct {
	synced   bool
	retained map[string]struct{}
	released map[string]struct{}
}

func (view retentionView) retains(keyID string) bool {
	_, retained := view.retained[keyID]
	return retained
}

func (view retentionView) releases(keyID string) bool {
	_, released := view.released[keyID]
	return released
}

func (c *Cache) Retain(keyIDs []string) {
	desired := make(map[string]struct{}, len(keyIDs))
	for _, keyID := range keyIDs {
		if keyID != "" {
			desired[keyID] = struct{}{}
		}
	}
	c.retention.mu.Lock()
	changed := !c.retention.synced || !maps.Equal(desired, c.retention.retained)
	for keyID := range c.retention.retained {
		if _, kept := desired[keyID]; !kept {
			c.retention.released[keyID] = struct{}{}
		}
	}
	for keyID := range desired {
		delete(c.retention.released, keyID)
	}
	c.retention.retained, c.retention.synced = desired, true
	c.retention.mu.Unlock()
	if changed {
		c.requestCollection()
	}
}

func (c *Cache) retentionView() retentionView {
	c.retention.mu.Lock()
	defer c.retention.mu.Unlock()
	return retentionView{
		synced:   c.retention.synced,
		retained: maps.Clone(c.retention.retained),
		released: maps.Clone(c.retention.released),
	}
}

func (c *Cache) settleReleased(keyIDs []string) {
	c.retention.mu.Lock()
	defer c.retention.mu.Unlock()
	for _, keyID := range keyIDs {
		delete(c.retention.released, keyID)
	}
}
