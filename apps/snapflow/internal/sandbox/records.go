// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"
	"maps"
	"sync"

	"github.com/snapflowio/snapflow/internal/state"
)

type RecordStore interface {
	LoadSandboxConvergences(context.Context) ([]state.SandboxConvergence, error)
	SaveSandboxConvergence(context.Context, state.SandboxConvergence) error
	DeleteSandboxConvergence(context.Context, string) error
}

type records struct {
	store RecordStore
	mu    sync.RWMutex
	byID  map[string]state.SandboxConvergence
}

func newRecords(store RecordStore) *records {
	return &records{store: store, byID: make(map[string]state.SandboxConvergence)}
}

func (records *records) load(ctx context.Context) error {
	loaded, err := records.store.LoadSandboxConvergences(ctx)
	if err != nil {
		return err
	}
	records.mu.Lock()
	defer records.mu.Unlock()
	for _, record := range loaded {
		records.byID[record.SandboxID] = record
	}
	return nil
}

func (records *records) get(sandboxID string) (state.SandboxConvergence, bool) {
	records.mu.RLock()
	defer records.mu.RUnlock()
	record, found := records.byID[sandboxID]
	return record, found
}

func (records *records) put(ctx context.Context, record state.SandboxConvergence) error {
	if err := records.store.SaveSandboxConvergence(ctx, record); err != nil {
		return err
	}
	records.mu.Lock()
	defer records.mu.Unlock()
	records.byID[record.SandboxID] = record
	return nil
}

func (records *records) remove(ctx context.Context, sandboxID string) error {
	if err := records.store.DeleteSandboxConvergence(ctx, sandboxID); err != nil {
		return err
	}
	records.mu.Lock()
	defer records.mu.Unlock()
	delete(records.byID, sandboxID)
	return nil
}

func (records *records) snapshot() map[string]state.SandboxConvergence {
	records.mu.RLock()
	defer records.mu.RUnlock()
	return maps.Clone(records.byID)
}
