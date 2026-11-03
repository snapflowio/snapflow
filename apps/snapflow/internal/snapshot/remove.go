// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"context"
	"errors"
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
	templateKey := store.releasedTemplateLocked(ref)
	store.mu.Unlock()

	err := store.removeHeld(ctx, ref, templateKey)
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

func (store *Store) releasedTemplateLocked(ref string) string {
	key := store.entries[ref].record.Template.GetKey()
	if key == "" {
		return ""
	}
	for other, current := range store.entries {
		if other != ref && current.record.Template.GetKey() == key {
			return ""
		}
	}
	return key
}

func (store *Store) removeHeld(ctx context.Context, ref, templateKey string) error {
	if templateKey != "" {
		if err := store.runtime.RemoveTemplate(ctx, templateKey); err != nil {
			return fmt.Errorf("remove template %s: %w", templateKey, err)
		}
	}
	if err := store.runtime.RemoveImage(ctx, ref); err != nil {
		return errors.Join(err, store.forgetTemplate(ctx, ref, templateKey))
	}
	return store.records.DeleteSnapshotRecord(ctx, ref)
}

func (store *Store) forgetTemplate(ctx context.Context, ref, templateKey string) error {
	if templateKey == "" {
		return nil
	}
	store.mu.Lock()
	current := store.entries[ref]
	if !current.present() || current.record.Template.GetKey() != templateKey {
		store.mu.Unlock()
		return nil
	}
	current.record.Template = nil
	record := current.record
	store.mu.Unlock()
	return store.records.SaveSnapshotRecord(ctx, record)
}
