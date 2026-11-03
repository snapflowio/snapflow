// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package snapshot

import (
	"context"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func (store *Store) Apply(revision uint64, snapshots []*machinev1alpha1.DesiredSnapshot) {
	desired := make(map[string]*machinev1alpha1.DesiredSnapshot, len(snapshots))
	for _, snapshot := range snapshots {
		desired[snapshot.GetRef()] = snapshot
	}
	store.mu.Lock()
	store.desired, store.revision, store.applied = desired, revision, true
	store.mu.Unlock()
	store.signal()
}

func (store *Store) converge(ctx context.Context) time.Duration {
	store.mu.Lock()
	defer store.mu.Unlock()
	if store.runCtx == nil {
		return store.policy.Interval
	}
	now := store.now()
	nextRetry := store.policy.Interval
	for ref, desired := range store.desired {
		if store.busy[ref] != nil {
			continue
		}
		current := store.entries[ref]
		switch {
		case current.present():
			store.prepareTemplateLocked(ctx, ref, current, desired)
		case desired.GetLocal() != nil:
		case store.pressure && prewarmed(desired):
		case current != nil && now.Before(current.retryAt):
			nextRetry = min(nextRetry, current.retryAt.Sub(now))
		default:
			store.startPullLocked(ctx, ref, pullSource{registryID: desired.GetRegistry().GetRegistryId()})
		}
	}
	store.forgetUndesiredFailuresLocked()
	return nextRetry
}

func (store *Store) prepareTemplateLocked(ctx context.Context, ref string, current *entry, desired *machinev1alpha1.DesiredSnapshot) {
	preparation := desired.GetTemplate()
	if preparation == nil || templateMatches(current.record.Template, preparation) || store.now().Before(current.retryAt) {
		return
	}
	work := newTask(taskTemplate)
	store.busy[ref] = work
	store.startTask(func() { store.runTemplate(ctx, ref, preparation, work) })
}

func (store *Store) forgetUndesiredFailuresLocked() {
	for ref, current := range store.entries {
		if current.present() || store.busy[ref] != nil || store.desired[ref] != nil || store.demands[ref] > 0 {
			continue
		}
		delete(store.entries, ref)
	}
}

func prewarmed(desired *machinev1alpha1.DesiredSnapshot) bool {
	return desired.GetRetention() == machinev1alpha1.SnapshotRetention_SNAPSHOT_RETENTION_PREWARM
}

func (store *Store) desiredDigest(ref string) string {
	store.mu.Lock()
	defer store.mu.Unlock()
	return store.desired[ref].GetDigest()
}

func (store *Store) startTask(work func()) {
	store.tasks.Add(1)
	go func() {
		defer store.tasks.Done()
		work()
	}()
}
