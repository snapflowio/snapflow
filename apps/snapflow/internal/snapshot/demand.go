// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"context"
	"fmt"
	"sync"

	"github.com/snapflowio/snapflow/internal/state"
	"github.com/snapflowio/snapflow/internal/workload"
)

func (store *Store) Ensure(ctx context.Context, ref string) (func(), error) {
	if err := store.awaitStart(ctx); err != nil {
		return nil, err
	}
	release := store.demand(ref)
	for {
		work, err := store.awaitPresence(ctx, ref)
		if err != nil {
			release()
			return nil, err
		}
		if work == nil {
			return release, nil
		}
		select {
		case <-work.done:
		case <-ctx.Done():
			release()
			return nil, ctx.Err()
		}
		if work.kind == taskPull && work.err != nil {
			release()
			return nil, work.err
		}
	}
}

func (store *Store) awaitPresence(ctx context.Context, ref string) (*task, error) {
	store.mu.Lock()
	present := store.entries[ref].present()
	store.mu.Unlock()
	if present {
		if _, err := store.runtime.ImageInfo(ctx, ref); err != nil {
			if forgetErr := store.forget(ctx, ref); forgetErr != nil {
				return nil, forgetErr
			}
		}
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if work := store.busy[ref]; work != nil {
		return work, nil
	}
	if store.entries[ref].present() {
		return nil, nil
	}
	if store.desired[ref].GetLocal() != nil {
		return nil, fmt.Errorf("snapshot %s: %w", ref, workload.ErrLocalSnapshotNotHeld)
	}
	return store.startPullLocked(store.runCtx, ref, pullSource{ //nolint:contextcheck // demanded pulls outlive the request and run under the store lifetime context
		registryID: store.desired[ref].GetRegistry().GetRegistryId(), demanded: true,
	}), nil
}

func (store *Store) demand(ref string) func() {
	store.mu.Lock()
	store.demands[ref]++
	store.mu.Unlock()
	var once sync.Once
	return func() {
		once.Do(func() {
			store.mu.Lock()
			defer store.mu.Unlock()
			store.demands[ref]--
			if store.demands[ref] == 0 {
				delete(store.demands, ref)
			}
		})
	}
}

func (store *Store) Adopt(ctx context.Context, ref string) error {
	info, err := store.runtime.ImageInfo(ctx, ref)
	if err != nil {
		return err
	}
	if err := store.markPresent(ctx, state.SnapshotRecord{Ref: ref, Digest: info.Digest, SizeBytes: info.SizeBytes}); err != nil {
		return err
	}
	store.requestReport()
	store.signal()
	return nil
}

func (store *Store) forget(ctx context.Context, ref string) error {
	if err := store.records.DeleteSnapshotRecord(ctx, ref); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if store.busy[ref] == nil {
		delete(store.entries, ref)
	}
	return nil
}
