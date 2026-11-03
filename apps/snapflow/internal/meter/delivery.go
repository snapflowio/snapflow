// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"sync/atomic"
	"time"

	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	maximumReadingAge       = 15 * time.Minute
	usageChainRetention     = 24 * time.Hour
	listPlacementsOperation = "list usage placements"
	submitReceiptOperation  = "submit usage receipt"
)

type placementKey struct {
	sandboxID  string
	generation uint32
}

func (reporter *Reporter) deliverPending(ctx context.Context, placements []apiclient.MachineReportablePlacementDto) bool {
	readings, quarantined, err := reporter.store.LoadUsageReadings(ctx)
	if err != nil {
		if ctx.Err() == nil {
			reporter.log.ErrorContext(ctx, "Failed to load pending usage readings", "error", err)
		}
		return false
	}
	state.LogDeadLetters(ctx, reporter.log, quarantined)
	reporter.pruneChains(ctx)
	reportable := reportablePlacements(placements)
	groups := groupByPlacement(readings)
	var settled atomic.Bool
	settled.Store(ctx.Err() == nil)
	forEachParallel(ctx, reporter.parallelism, slices.Collect(maps.Keys(groups)), func(key placementKey) {
		placement, found := reportable[key]
		for _, reading := range groups[key] {
			if !reporter.deliver(ctx, placement, found, reading) {
				settled.Store(false)
				return
			}
		}
	})
	return settled.Load() && ctx.Err() == nil
}

func (reporter *Reporter) pruneChains(ctx context.Context) {
	if err := reporter.store.PruneUsageChainHeads(ctx, reporter.now().Add(-usageChainRetention)); err != nil && ctx.Err() == nil {
		reporter.log.WarnContext(ctx, "Failed to prune stale usage chain heads", "error", err)
	}
}

func reportablePlacements(placements []apiclient.MachineReportablePlacementDto) map[placementKey]apiclient.MachineReportablePlacementDto {
	reportable := make(map[placementKey]apiclient.MachineReportablePlacementDto, len(placements))
	for _, placement := range placements {
		if generation, err := assignmentGeneration(placement.AssignmentGeneration); err == nil {
			reportable[placementKey{sandboxID: placement.SandboxId, generation: generation}] = placement
		}
	}
	return reportable
}

func groupByPlacement(readings []state.UsageReading) map[placementKey][]state.UsageReading {
	firstSaved := make(map[string]int64)
	groups := make(map[placementKey][]state.UsageReading)
	for _, reading := range readings {
		if first, seen := firstSaved[reading.Sample.GenerationID]; !seen || reading.ID < first {
			firstSaved[reading.Sample.GenerationID] = reading.ID
		}
		key := placementKey{sandboxID: reading.SandboxID, generation: reading.AssignmentGeneration}
		groups[key] = append(groups[key], reading)
	}
	for _, group := range groups {
		slices.SortFunc(group, func(left, right state.UsageReading) int {
			return cmp.Or(
				cmp.Compare(firstSaved[left.Sample.GenerationID], firstSaved[right.Sample.GenerationID]),
				cmp.Compare(left.Sample.Sequence, right.Sample.Sequence),
				cmp.Compare(left.ID, right.ID),
			)
		})
	}
	return groups
}

func (reporter *Reporter) deliver(
	ctx context.Context,
	placement apiclient.MachineReportablePlacementDto,
	reportable bool,
	reading state.UsageReading,
) bool {
	if !reportable {
		if reporter.now().Sub(reading.Sample.SampledAt) <= maximumReadingAge {
			return false
		}
		reporter.log.WarnContext(ctx, "Dropping a usage reading whose placement is no longer reportable",
			"sandbox_id", reading.SandboxID, "assignment_generation", reading.AssignmentGeneration)
		return reporter.forget(ctx, reading)
	}
	signed, err := reporter.sign(ctx, placement, reading)
	if err == nil {
		err = reporter.client.Submit(ctx, signed.receipt)
	}
	if err == nil {
		return reporter.accept(ctx, reading, signed)
	}
	if !errors.Is(err, ErrUnreportableReading) && !control.IsRefusal(err) {
		if ctx.Err() == nil {
			reporter.log.WarnContext(ctx, "Usage reading delivery failed; it will be resent",
				"sandbox_id", reading.SandboxID, "placement_id", placement.PlacementId, "error", err)
		}
		return false
	}
	reporter.log.WarnContext(ctx, "Control plane refused a usage reading; dropping it",
		"sandbox_id", reading.SandboxID, "placement_id", placement.PlacementId, "error", err)
	return reporter.forget(ctx, reading)
}

func (reporter *Reporter) sign(
	ctx context.Context,
	placement apiclient.MachineReportablePlacementDto,
	reading state.UsageReading,
) (signedReceipt, error) {
	chain := state.UsageChainKey{PlacementID: placement.PlacementId.String(), GenerationID: reading.Sample.GenerationID}
	previousDigest, found, err := reporter.store.LoadUsageChainHead(ctx, chain)
	if err != nil {
		return signedReceipt{}, fmt.Errorf("load usage chain head: %w", err)
	}
	if !found {
		previousDigest = genesisDigest()
	}
	return signReceipt(reporter.identity, placement, reading.Sample, previousDigest)
}

func (reporter *Reporter) accept(ctx context.Context, reading state.UsageReading, signed signedReceipt) bool {
	head := state.UsageChainHead{Key: signed.chain, Digest: signed.digest, UpdatedAt: reporter.now()}
	if err := reporter.store.AcceptUsageReading(ctx, reading.ID, head); err != nil {
		reporter.log.ErrorContext(ctx, "Failed to record an accepted usage reading", "sandbox_id", reading.SandboxID, "error", err)
		return false
	}
	return true
}

func (reporter *Reporter) forget(ctx context.Context, reading state.UsageReading) bool {
	if err := reporter.store.DeleteUsageReading(ctx, reading.ID); err != nil {
		reporter.log.ErrorContext(ctx, "Failed to forget a settled usage reading", "sandbox_id", reading.SandboxID, "error", err)
		return false
	}
	return true
}
