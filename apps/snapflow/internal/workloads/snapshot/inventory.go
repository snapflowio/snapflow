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
	"slices"
	"strings"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const (
	maximumReportedSnapshots   = 192
	maximumReportBytes         = 96 * 1024
	reportEnvelopeAllowance    = 256
	snapshotSeparatorAllowance = 2
)

func (store *Store) reportLogged(ctx context.Context) {
	if err := store.reportInventory(ctx); err != nil && ctx.Err() == nil {
		store.log.WarnContext(ctx, "Failed to report the snapshot inventory", "error", err)
	}
}

func (store *Store) reportInventory(ctx context.Context) error {
	inventory, ready, err := store.Inventory()
	if err != nil || !ready {
		return err
	}
	requestContext, cancel := context.WithTimeout(ctx, store.requestTimeout)
	defer cancel()
	return store.control.ReportInventory(requestContext, inventory)
}

func (store *Store) Inventory() (*machinev1alpha1.MachineSnapshotInventory, bool, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	if !store.applied {
		return nil, false, nil
	}
	snapshots := make([]*machinev1alpha1.ObservedSnapshot, 0, len(store.entries))
	for ref, current := range store.entries {
		snapshots = append(snapshots, observedSnapshot(ref, current))
	}
	slices.SortFunc(snapshots, store.reportOrderLocked)
	bounded, err := withinReportLimits(snapshots)
	if err != nil {
		return nil, false, err
	}
	return &machinev1alpha1.MachineSnapshotInventory{DesiredStateRevision: store.revision, Snapshots: bounded}, true, nil
}

func (store *Store) reportOrderLocked(left, right *machinev1alpha1.ObservedSnapshot) int {
	leftDesired, rightDesired := store.desired[left.GetRef()] != nil, store.desired[right.GetRef()] != nil
	switch {
	case leftDesired && !rightDesired:
		return -1
	case rightDesired && !leftDesired:
		return 1
	default:
		return strings.Compare(left.GetRef(), right.GetRef())
	}
}

func withinReportLimits(snapshots []*machinev1alpha1.ObservedSnapshot) ([]*machinev1alpha1.ObservedSnapshot, error) {
	size := reportEnvelopeAllowance
	for index, snapshot := range snapshots {
		encoded, err := protojson.Marshal(snapshot)
		if err != nil {
			return nil, fmt.Errorf("encode snapshot %s inventory: %w", snapshot.GetRef(), err)
		}
		size += len(encoded) + snapshotSeparatorAllowance
		if index == maximumReportedSnapshots || size > maximumReportBytes {
			return snapshots[:index], nil
		}
	}
	return snapshots, nil
}

func observedSnapshot(ref string, current *entry) *machinev1alpha1.ObservedSnapshot {
	observed := &machinev1alpha1.ObservedSnapshot{Ref: ref, State: current.state}
	if current.errorReason != "" {
		observed.ErrorReason = proto.String(current.errorReason)
	}
	if !current.present() {
		return observed
	}
	observed.Digest = proto.String(current.record.Digest)
	observed.SizeBytes = current.record.SizeBytes
	if template := current.record.Template; template.GetKey() != "" {
		observed.Template = proto.CloneOf(template)
	}
	return observed
}
