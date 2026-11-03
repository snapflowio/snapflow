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
	"slices"

	"github.com/snapflowio/snapflow/internal/state"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

type pullSource struct {
	registryID string
	demanded   bool
}

func (store *Store) startPullLocked(ctx context.Context, ref string, source pullSource) *task {
	work := newTask(taskPull)
	store.busy[ref] = work
	current := store.entries[ref]
	if current == nil {
		current = &entry{backoff: store.pullBackoff}
		store.entries[ref] = current
	}
	current.state = machinev1alpha1.SnapshotInventoryState_SNAPSHOT_INVENTORY_STATE_PULLING
	current.errorReason = ""
	store.startTask(func() { store.runPull(ctx, ref, source, work) })
	store.requestReport()
	return work
}

func (store *Store) runPull(ctx context.Context, ref string, source pullSource, work *task) {
	err := store.pull(ctx, ref, source)
	store.mu.Lock()
	delete(store.busy, ref)
	store.finishPullLocked(ref, err)
	store.mu.Unlock()
	work.err = err
	close(work.done)
	if err != nil && ctx.Err() == nil {
		store.log.Warn("Snapshot pull failed", "ref", ref, "error", err)
	}
	store.requestReport()
	store.signal()
}

func (store *Store) finishPullLocked(ref string, err error) {
	current := store.entries[ref]
	if current == nil {
		return
	}
	if err == nil {
		current.backoff.Reset()
		return
	}
	current.state = machinev1alpha1.SnapshotInventoryState_SNAPSHOT_INVENTORY_STATE_FAILED
	current.errorReason = boundedReason(err.Error())
	current.retryAt = store.now().Add(current.backoff.Next())
}

func (store *Store) pull(ctx context.Context, ref string, source pullSource) error {
	if !source.demanded {
		select {
		case store.background <- struct{}{}:
			defer func() { <-store.background }()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	registry, err := store.credentials(ctx, source)
	if err != nil {
		return &unavailableError{ref: ref, err: err}
	}
	defer clearCredentials(registry)
	if err := store.runtime.PullImage(ctx, ref, registry); err != nil {
		return &unavailableError{ref: ref, err: err}
	}
	info, err := store.runtime.ImageInfo(ctx, ref)
	if err != nil {
		return &unavailableError{ref: ref, err: err}
	}
	if desired := store.desiredDigest(ref); desired != "" && info.Digest != desired {
		mismatch := &digestMismatchError{ref: ref, desired: desired, observed: info.Digest}
		return errors.Join(mismatch, store.runtime.RemoveImage(ctx, ref))
	}
	return store.markPresent(ctx, state.SnapshotRecord{Ref: ref, Digest: info.Digest, SizeBytes: info.SizeBytes})
}

func (store *Store) credentials(ctx context.Context, source pullSource) (*machinev1alpha1.Registry, error) {
	if source.registryID == "" {
		return nil, nil
	}
	requestContext, cancel := context.WithTimeout(ctx, store.requestTimeout)
	defer cancel()
	registry, err := store.control.RegistryCredentials(requestContext, source.registryID)
	if err != nil {
		return nil, fmt.Errorf("fetch credentials of registry %s: %w", source.registryID, err)
	}
	return registry, nil
}

func clearCredentials(registry *machinev1alpha1.Registry) {
	if registry != nil {
		registry.Username, registry.Password = nil, nil
	}
}

func (store *Store) markPresent(ctx context.Context, record state.SnapshotRecord) error {
	store.mu.Lock()
	if previous := store.entries[record.Ref]; previous != nil && previous.record.Digest == record.Digest {
		record.Template = previous.record.Template
	}
	store.mu.Unlock()
	if err := store.records.SaveSnapshotRecord(ctx, record); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	current := store.entries[record.Ref]
	if current == nil {
		current = &entry{backoff: store.pullBackoff}
		store.entries[record.Ref] = current
	}
	current.state = machinev1alpha1.SnapshotInventoryState_SNAPSHOT_INVENTORY_STATE_PRESENT
	current.record = record
	current.errorReason = ""
	current.retryAt = store.now()
	return nil
}

func (store *Store) runTemplate(ctx context.Context, ref string, preparation *machinev1alpha1.TemplatePreparation, work *task) {
	key, err := store.runtime.PrepareTemplate(ctx, ref, preparation)
	if err == nil {
		err = store.recordTemplate(ctx, ref, key, preparation)
	}
	store.mu.Lock()
	delete(store.busy, ref)
	if current := store.entries[ref]; current != nil {
		if err == nil {
			current.errorReason = ""
			current.backoff.Reset()
		} else {
			current.errorReason = boundedReason(fmt.Sprintf("prepare runtime template: %v", err))
			current.retryAt = store.now().Add(current.backoff.Next())
		}
	}
	store.mu.Unlock()
	work.err = err
	close(work.done)
	if err != nil && ctx.Err() == nil {
		store.log.Warn("Snapshot template preparation failed", "ref", ref, "error", err)
	}
	store.requestReport()
	store.signal()
}

func (store *Store) recordTemplate(ctx context.Context, ref, key string, preparation *machinev1alpha1.TemplatePreparation) error {
	store.mu.Lock()
	current := store.entries[ref]
	if !current.present() {
		store.mu.Unlock()
		return nil
	}
	record := current.record
	store.mu.Unlock()
	record.Template = &machinev1alpha1.PreparedTemplate{
		Key: key, CpuQuota: preparation.GetCpuQuota(), MemoryQuota: preparation.GetMemoryQuota(),
		StorageQuota: preparation.GetStorageQuota(), Capabilities: slices.Clone(preparation.GetCapabilities()),
	}
	if err := store.records.SaveSnapshotRecord(ctx, record); err != nil {
		return err
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if current := store.entries[ref]; current.present() {
		current.record = record
	}
	return nil
}
