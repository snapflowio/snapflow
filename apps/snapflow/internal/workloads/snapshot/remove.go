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
)

func (store *Store) remove(ctx context.Context, target candidate, inUse map[string]bool) error {
	ref := target.ref
	store.mu.Lock()
	if !store.entries[ref].present() || store.keepsLocked(target, inUse) {
		store.mu.Unlock()
		return nil
	}
	work := newTask(taskRemoval)
	store.busy[ref] = work
	store.mu.Unlock()

	err := store.removeHeld(ctx, ref)
	store.mu.Lock()
	delete(store.busy, ref)
	if err == nil {
		delete(store.entries, ref)
	}
	store.mu.Unlock()
	work.err = err
	close(work.done)
	if err != nil {
		return fmt.Errorf("remove snapshot %s: %w", ref, err)
	}
	store.log.InfoContext(ctx, "Removed a snapshot", "ref", ref, "prewarmed", target.prewarmed)
	store.requestReport()
	return nil
}

func (store *Store) removeHeld(ctx context.Context, ref string) error {
	if err := store.runtime.RemoveImage(ctx, ref); err != nil {
		return err
	}
	return store.records.DeleteSnapshotRecord(ctx, ref)
}
