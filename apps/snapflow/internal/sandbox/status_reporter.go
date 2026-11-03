// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"context"
	"fmt"
	"log/slog"
	"maps"
	"slices"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	maximumStatusesPerReport = 100
	maximumReportBytes       = 96 * 1024
	reportEnvelopeAllowance  = 256
	statusSeparatorAllowance = 2
)

type statusReporter struct {
	log      *slog.Logger
	control  ConvergenceAPI
	runtime  sandboxruntime.Inventory
	records  *records
	activity *activity
	local    *LocalRuntimes
	document func() *machinev1alpha1.MachineDesiredState
	interval time.Duration
	timeout  time.Duration
	trigger  chan struct{}
}

func (reporter *statusReporter) request() {
	select {
	case reporter.trigger <- struct{}{}:
	default:
	}
}

func (reporter *statusReporter) run(ctx context.Context) {
	ticker := time.NewTicker(reporter.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-reporter.trigger:
		}
		reporter.reportLogged(ctx)
	}
}

func (reporter *statusReporter) reportLogged(ctx context.Context) {
	if err := reporter.report(ctx); err != nil && ctx.Err() == nil {
		reporter.log.WarnContext(ctx, "Failed to report sandbox observed status", "error", err)
	}
}

func (reporter *statusReporter) report(ctx context.Context) error {
	document := reporter.document()
	if document == nil {
		return nil
	}
	statuses, err := reporter.collect(ctx, document)
	if err != nil {
		return err
	}
	reports, err := chunkStatuses(document.GetRevision(), statuses)
	if err != nil {
		return err
	}
	for _, report := range reports {
		requestContext, cancel := context.WithTimeout(ctx, reporter.timeout)
		result, err := reporter.control.ReportStatus(requestContext, report)
		cancel()
		if err != nil {
			return err
		}
		reporter.apply(ctx, document.GetRevision(), result)
	}
	return nil
}

func (reporter *statusReporter) collect(
	ctx context.Context,
	document *machinev1alpha1.MachineDesiredState,
) ([]*machinev1alpha1.SandboxObservedStatus, error) {
	inventory, err := reporter.runtime.RuntimeInventory(ctx)
	if err != nil {
		return nil, fmt.Errorf("inspect runtime inventory: %w", err)
	}
	hosted := reporter.hosted(inventory)
	records := reporter.records.snapshot()
	converging := reporter.activity.convergingSnapshot()
	views := make([]sandboxView, 0, len(document.GetSandboxes())+len(hosted))
	for _, desired := range document.GetSandboxes() {
		sandboxID := desired.GetSandboxId()
		views = append(views, sandboxView{sandboxID: sandboxID, desired: desired, runtime: hosted[sandboxID], converging: converging[sandboxID]})
		delete(hosted, sandboxID)
	}
	for _, sandboxID := range slices.Sorted(maps.Keys(hosted)) {
		views = append(views, sandboxView{sandboxID: sandboxID, runtime: hosted[sandboxID]})
	}
	observedAt := time.Now()
	statuses := make([]*machinev1alpha1.SandboxObservedStatus, 0, len(views))
	for _, view := range views {
		if record, found := records[view.sandboxID]; found {
			view.record = &record
		}
		if status, reportable := observedStatus(view, observedAt); reportable {
			statuses = append(statuses, status)
		}
	}
	return statuses, nil
}

func (reporter *statusReporter) hosted(inventory []microvmtypes.RuntimeObservation) map[string]*microvmtypes.RuntimeObservation {
	hosted := make(map[string]*microvmtypes.RuntimeObservation, len(inventory))
	for index := range inventory {
		observation := &inventory[index]
		if observation.ControlPlaneManaged && !reporter.local.isHeld(observation.ID) {
			hosted[observation.ID] = observation
		}
	}
	return hosted
}

func (reporter *statusReporter) apply(ctx context.Context, revision uint64, result *machinev1alpha1.SandboxObservedStatusReportResult) {
	for _, acknowledgement := range result.GetAcknowledgements() {
		sandboxID := acknowledgement.GetSandboxId()
		switch acknowledgement.GetVerdict() {
		case machinev1alpha1.SandboxObservedStatusVerdict_SANDBOX_OBSERVED_STATUS_VERDICT_STALE,
			machinev1alpha1.SandboxObservedStatusVerdict_SANDBOX_OBSERVED_STATUS_VERDICT_UNKNOWN:
			reporter.activity.suppress(sandboxID, revision)
			reporter.log.InfoContext(
				ctx, "Control plane rejected a sandbox status; waiting for the next desired state",
				"sandbox_id", sandboxID, "verdict", acknowledgement.GetVerdict().String(), "reason", acknowledgement.GetReason(),
			)
		case machinev1alpha1.SandboxObservedStatusVerdict_SANDBOX_OBSERVED_STATUS_VERDICT_INVALID:
			reporter.log.WarnContext(
				ctx, "Control plane found a sandbox status invalid",
				"sandbox_id", sandboxID, "reason", acknowledgement.GetReason(),
			)
		}
	}
}

func chunkStatuses(revision uint64, statuses []*machinev1alpha1.SandboxObservedStatus) ([]*machinev1alpha1.SandboxObservedStatusReport, error) {
	var reports []*machinev1alpha1.SandboxObservedStatusReport
	var current []*machinev1alpha1.SandboxObservedStatus
	size := reportEnvelopeAllowance
	for _, status := range statuses {
		encoded, err := protojson.Marshal(status)
		if err != nil {
			return nil, fmt.Errorf("encode sandbox %s observed status: %w", status.GetSandboxId(), err)
		}
		statusSize := len(encoded) + statusSeparatorAllowance
		if len(current) == maximumStatusesPerReport || (len(current) > 0 && size+statusSize > maximumReportBytes) {
			reports = append(reports, &machinev1alpha1.SandboxObservedStatusReport{DesiredStateRevision: revision, Statuses: current})
			current, size = nil, reportEnvelopeAllowance
		}
		current = append(current, status)
		size += statusSize
	}
	if len(current) > 0 {
		reports = append(reports, &machinev1alpha1.SandboxObservedStatusReport{DesiredStateRevision: revision, Statuses: current})
	}
	return reports, nil
}
