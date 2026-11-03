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
	"strings"
	"time"

	"github.com/snapflowio/snapflow/internal/state"
)

type candidate struct {
	ref           string
	unwantedSince time.Time
	prewarmed     bool
}

func (store *Store) collectLogged(ctx context.Context) {
	if err := store.collect(ctx); err != nil && ctx.Err() == nil {
		store.log.WarnContext(ctx, "Snapshot garbage collection failed", "error", err)
	}
}

func (store *Store) collect(ctx context.Context) error {
	inUse, err := store.inUse(ctx)
	if err != nil {
		return err
	}
	if err := store.forgetMissing(ctx); err != nil {
		return err
	}
	store.mu.Lock()
	if !store.applied {
		store.mu.Unlock()
		return nil
	}
	changed, candidates := store.markUnwantedLocked(inUse, store.now())
	store.mu.Unlock()
	for _, record := range changed {
		if err := store.records.SaveSnapshotRecord(ctx, record); err != nil {
			return err
		}
	}
	return store.removeCandidates(ctx, inUse, candidates)
}

func (store *Store) inUse(ctx context.Context) (map[string]bool, error) {
	inventory, err := store.runtime.RuntimeInventory(ctx)
	if err != nil {
		return nil, fmt.Errorf("inspect runtimes holding snapshots: %w", err)
	}
	inUse := make(map[string]bool, len(inventory))
	for index := range inventory {
		if image := strings.TrimSpace(inventory[index].Image); image != "" {
			inUse[image] = true
		}
	}
	return inUse, nil
}

func (store *Store) forgetMissing(ctx context.Context) error {
	for _, ref := range store.presentRefs() {
		if _, err := store.runtime.ImageInfo(ctx, ref); err != nil {
			if forgetErr := store.forget(ctx, ref); forgetErr != nil {
				return forgetErr
			}
		}
	}
	return nil
}

func (store *Store) presentRefs() []string {
	store.mu.Lock()
	defer store.mu.Unlock()
	refs := make([]string, 0, len(store.entries))
	for ref, current := range store.entries {
		if current.present() && store.busy[ref] == nil {
			refs = append(refs, ref)
		}
	}
	return refs
}

func (store *Store) markUnwantedLocked(inUse map[string]bool, now time.Time) ([]state.SnapshotRecord, []candidate) {
	var changed []state.SnapshotRecord
	var unwanted, prewarms []candidate
	for ref, current := range store.entries {
		if !current.present() {
			continue
		}
		protected := store.protectedLocked(ref, inUse)
		if markUnwanted(current, protected, now) {
			changed = append(changed, current.record)
		}
		switch {
		case !protected:
			unwanted = append(unwanted, candidate{ref: ref, unwantedSince: current.record.UnwantedSince})
		case !store.requiredLocked(ref, inUse):
			prewarms = append(prewarms, candidate{ref: ref, prewarmed: true})
		}
	}
	slices.SortFunc(unwanted, func(left, right candidate) int {
		return left.unwantedSince.Compare(right.unwantedSince)
	})
	slices.SortFunc(prewarms, func(left, right candidate) int {
		return strings.Compare(left.ref, right.ref)
	})
	return changed, append(unwanted, prewarms...)
}

func markUnwanted(current *entry, protected bool, now time.Time) bool {
	switch {
	case protected && !current.record.UnwantedSince.IsZero():
		current.record.UnwantedSince = time.Time{}
	case !protected && current.record.UnwantedSince.IsZero():
		current.record.UnwantedSince = now
	default:
		return false
	}
	return true
}

func (store *Store) protectedLocked(ref string, inUse map[string]bool) bool {
	return store.desired[ref] != nil || store.requiredLocked(ref, inUse)
}

func (store *Store) requiredLocked(ref string, inUse map[string]bool) bool {
	desired := store.desired[ref]
	return (desired != nil && !prewarmed(desired)) || inUse[ref] || store.demands[ref] > 0 || store.busy[ref] != nil
}

func (store *Store) keepsLocked(target candidate, inUse map[string]bool) bool {
	if target.prewarmed {
		return store.requiredLocked(target.ref, inUse)
	}
	return store.protectedLocked(target.ref, inUse)
}

func (store *Store) removeCandidates(ctx context.Context, inUse map[string]bool, candidates []candidate) error {
	pressure, err := store.underPressure(ctx, store.policy.HighThresholdPercent)
	if err != nil {
		return err
	}
	now := store.now()
	var errs []error
	for _, target := range candidates {
		if !pressure && (target.prewarmed || now.Sub(target.unwantedSince) < store.policy.GracePeriod) {
			continue
		}
		if err := store.remove(ctx, target, inUse); err != nil {
			errs = append(errs, err)
			continue
		}
		if pressure {
			aboveLow, err := store.underPressure(ctx, store.policy.LowThresholdPercent)
			if err != nil {
				return errors.Join(append(errs, err)...)
			}
			pressure = aboveLow
		}
	}
	store.mu.Lock()
	store.pressure = pressure
	store.mu.Unlock()
	return errors.Join(errs...)
}

func (store *Store) underPressure(ctx context.Context, threshold float64) (bool, error) {
	usage, err := store.diskUsage(ctx)
	if err != nil {
		return false, fmt.Errorf("measure snapshot disk usage: %w", err)
	}
	return usage >= threshold, nil
}
