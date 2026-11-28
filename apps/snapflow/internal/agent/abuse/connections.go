// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package abuse

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/types"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	ConnectionReportInterval  = 5 * time.Minute
	maximumFlowsPerWorkload   = 20_000
	maximumFlowsPerReport     = 20_000
	connectionReportBatchSize = 64
)

type workload struct {
	id     uuid.UUID
	tenant uuid.UUID
}

func sandboxWorkload(id uuid.UUID) workload {
	return workload{id: id}
}

func parseWorkload(instanceID, buildTenant string) (workload, error) {
	id, err := uuid.Parse(instanceID)
	if err != nil {
		return workload{}, fmt.Errorf("parse workload ID %q: %w", instanceID, err)
	}
	if buildTenant == "" {
		return sandboxWorkload(id), nil
	}
	tenant, err := uuid.Parse(buildTenant)
	if err != nil {
		return workload{}, fmt.Errorf("parse build tenant %q of builder %s: %w", buildTenant, id, err)
	}
	return workload{id: id, tenant: tenant}, nil
}

func (subject workload) builder() bool {
	return subject.tenant != uuid.Nil
}

type flowWindow struct {
	firstSeen time.Time
	lastSeen  time.Time
}

type workloadFlows struct {
	workload
	flows      map[types.ConnectionRecord]*flowWindow
	overflowed bool
}

type connectionLedger struct {
	workloads    map[uuid.UUID]*workloadFlows
	sampledAt    map[uuid.UUID]time.Time
	previousPass time.Time
	currentPass  time.Time
	windowStart  time.Time
	degraded     bool
}

func newConnectionLedger(now time.Time) *connectionLedger {
	return &connectionLedger{
		workloads: make(map[uuid.UUID]*workloadFlows), sampledAt: make(map[uuid.UUID]time.Time),
		previousPass: now, currentPass: now, windowStart: now,
	}
}

func (ledger *connectionLedger) beginPass(now time.Time) {
	ledger.previousPass = ledger.currentPass
	ledger.currentPass = now
}

func (ledger *connectionLedger) degrade() {
	ledger.degraded = true
}

func (ledger *connectionLedger) retain(present map[uuid.UUID]struct{}) {
	for id := range ledger.sampledAt {
		if _, ok := present[id]; !ok {
			delete(ledger.sampledAt, id)
		}
	}
}

func (ledger *connectionLedger) observe(subject workload, sample types.AbuseSample) {
	if sample.Running && !sample.Guard.Available {
		ledger.degraded = true
		return
	}
	ledger.record(subject, sample.Guard.Connections, sample.SampledAt)
}

func (ledger *connectionLedger) observeReleased(batch types.ReleasedConnectionBatch, local LocalWorkloads) {
	if !batch.Complete {
		ledger.degraded = true
	}
	for _, reading := range batch.Readings {
		if local.Local(reading.InstanceID) {
			continue
		}
		subject, err := parseWorkload(reading.InstanceID, reading.BuildTenant)
		if err != nil || !reading.Complete {
			ledger.degraded = true
		}
		if err == nil {
			ledger.record(subject, reading.Connections, reading.ReleasedAt)
		}
	}
}

func (ledger *connectionLedger) record(subject workload, connections []types.ConnectionRecord, sampledAt time.Time) {
	ledger.checkGap(subject.id, sampledAt)
	if len(connections) == 0 {
		return
	}
	entry := ledger.workloads[subject.id]
	if entry == nil {
		entry = &workloadFlows{workload: subject, flows: make(map[types.ConnectionRecord]*flowWindow)}
		ledger.workloads[subject.id] = entry
	}
	if len(connections) >= types.ConnectionRecordCapacity {
		entry.overflowed = true
	}
	for _, record := range connections {
		if window, seen := entry.flows[record]; seen {
			window.lastSeen = sampledAt
			continue
		}
		if len(entry.flows) >= maximumFlowsPerWorkload {
			entry.overflowed = true
			continue
		}
		entry.flows[record] = &flowWindow{firstSeen: sampledAt.Add(-types.ConnectionRecordWindow), lastSeen: sampledAt}
	}
}

func (ledger *connectionLedger) checkGap(id uuid.UUID, sampledAt time.Time) {
	previous, known := ledger.sampledAt[id]
	if !known {
		previous = ledger.previousPass
	}
	if sampledAt.Sub(previous) > types.ConnectionRecordWindow {
		ledger.degraded = true
	}
	if sampledAt.After(previous) || !known {
		ledger.sampledAt[id] = sampledAt
	}
}

func (ledger *connectionLedger) due(now time.Time) bool {
	return now.Sub(ledger.windowStart) >= ConnectionReportInterval
}

func (ledger *connectionLedger) drain(now time.Time) []apiclient.MachineConnectionReport {
	reports := []apiclient.MachineConnectionReport{ledger.newReport(now)}
	reportFlows := 0
	for _, entry := range ledger.workloads {
		flows := connectionFlows(entry.flows)
		for len(flows) > 0 {
			last := &reports[len(reports)-1]
			if reportFlows == maximumFlowsPerReport || len(last.Sandboxes)+len(last.Builders) == connectionReportBatchSize {
				reports = append(reports, ledger.newReport(now))
				reportFlows = 0
				last = &reports[len(reports)-1]
			}
			take := min(len(flows), maximumFlowsPerReport-reportFlows)
			appendWorkloadFlows(last, entry, flows[:take])
			flows = flows[take:]
			reportFlows += take
		}
	}
	reports[len(reports)-1].Complete = !ledger.degraded
	ledger.workloads = make(map[uuid.UUID]*workloadFlows)
	ledger.windowStart = now
	ledger.degraded = false
	return reports
}

func appendWorkloadFlows(report *apiclient.MachineConnectionReport, entry *workloadFlows, flows []apiclient.MachineConnectionFlow) {
	if entry.builder() {
		report.Builders = append(report.Builders, apiclient.MachineBuilderConnections{
			BuilderId: entry.id, OrganizationId: entry.tenant, Flows: flows, Overflowed: entry.overflowed,
		})
		return
	}
	report.Sandboxes = append(report.Sandboxes, apiclient.MachineSandboxConnections{
		SandboxId: entry.id, Flows: flows, Overflowed: entry.overflowed,
	})
}

func (ledger *connectionLedger) newReport(now time.Time) apiclient.MachineConnectionReport {
	return apiclient.MachineConnectionReport{
		Sandboxes:   []apiclient.MachineSandboxConnections{},
		Builders:    []apiclient.MachineBuilderConnections{},
		WindowStart: ledger.windowStart.UTC(),
		WindowEnd:   now.UTC(),
	}
}

func connectionFlows(flows map[types.ConnectionRecord]*flowWindow) []apiclient.MachineConnectionFlow {
	result := make([]apiclient.MachineConnectionFlow, 0, len(flows))
	for record, window := range flows {
		result = append(result, apiclient.MachineConnectionFlow{
			DestinationAddress: record.Address.String(),
			DestinationPort:    int(record.Port),
			Protocol:           apiclient.ConnectionProtocol(record.Protocol),
			FirstSeenAt:        window.firstSeen.UTC(),
			LastSeenAt:         window.lastSeen.UTC(),
		})
	}
	return result
}

func (monitor *Monitor) recordConnections(ctx context.Context, now time.Time) {
	monitor.connections.observeReleased(monitor.runtime.ReleasedConnections(), monitor.local)
	if monitor.connections.due(now) {
		monitor.outbox.enqueue(ctx, monitor.connections.drain(now))
	}
}
