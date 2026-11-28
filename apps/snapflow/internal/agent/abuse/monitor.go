// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package abuse

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/types"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type Runtime interface {
	RuntimeInventory(context.Context) ([]types.RuntimeObservation, error)
	AbuseSample(context.Context, string) (types.AbuseSample, error)
	ReleasedConnections() types.ReleasedConnectionBatch
}

type LocalWorkloads interface {
	Local(string) bool
}

type Control interface {
	ReportAbuseSignals(context.Context, apiclient.MachineAbuseReport) error
	ReportConnections(context.Context, apiclient.MachineConnectionReport) error
}

type Monitor struct {
	runtime     Runtime
	local       LocalWorkloads
	control     Control
	logger      *slog.Logger
	histories   map[uuid.UUID]*history
	connections *connectionLedger
	outbox      *connectionQueue
	primed      bool
}

func NewMonitor(runtime Runtime, local LocalWorkloads, control Control, logger *slog.Logger) (*Monitor, error) {
	if runtime == nil || local == nil || control == nil {
		return nil, errors.New("the abuse monitor needs the workload runtime, the local workloads and the control plane")
	}
	if logger == nil {
		logger = slog.Default()
	}
	outbox, err := newConnectionQueue(logger)
	if err != nil {
		return nil, fmt.Errorf("configure the connection report queue: %w", err)
	}
	return &Monitor{
		runtime: runtime, local: local, control: control, logger: logger,
		histories: make(map[uuid.UUID]*history), connections: newConnectionLedger(time.Now()), outbox: outbox,
	}, nil
}

func (monitor *Monitor) Run(ctx context.Context) error {
	var sender sync.WaitGroup
	sender.Go(func() { monitor.outbox.run(ctx, monitor.control) })
	defer sender.Wait()
	ticker := time.NewTicker(Window)
	defer ticker.Stop()
	for {
		if err := monitor.evaluate(ctx); err != nil && ctx.Err() == nil {
			monitor.logger.WarnContext(ctx, "Failed to evaluate sandbox abuse signals", "error", err)
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

func (monitor *Monitor) evaluate(ctx context.Context) error {
	monitor.connections.beginPass(time.Now())
	err := monitor.sampleSandboxes(ctx)
	monitor.recordConnections(ctx, time.Now())
	return err
}

func (monitor *Monitor) sampleSandboxes(ctx context.Context) error {
	observations, err := monitor.runtime.RuntimeInventory(ctx)
	if err != nil {
		monitor.connections.degrade()
		return fmt.Errorf("list sandboxes: %w", err)
	}
	report := apiclient.MachineAbuseReport{ObservedAt: time.Now().UTC(), Sandboxes: []apiclient.MachineSandboxAbuse{}}
	present := make(map[uuid.UUID]struct{}, len(observations))
	var failures []error
	for _, observation := range observations {
		if err := monitor.sampleObservation(ctx, observation, present, &report); err != nil {
			monitor.connections.degrade()
			failures = append(failures, err)
		}
	}
	for id := range monitor.histories {
		if _, ok := present[id]; !ok {
			delete(monitor.histories, id)
		}
	}
	monitor.connections.retain(present)
	monitor.primed = true
	if len(report.Sandboxes) > 0 {
		failures = append(failures, monitor.control.ReportAbuseSignals(ctx, report))
	}
	return errors.Join(failures...)
}

func (monitor *Monitor) sampleObservation(
	ctx context.Context,
	observation types.RuntimeObservation,
	present map[uuid.UUID]struct{},
	report *apiclient.MachineAbuseReport,
) error {
	if monitor.local.Local(observation.ID) {
		return nil
	}
	if observation.BuildTenant != "" {
		return monitor.sampleBuilder(ctx, observation, present)
	}
	if !observation.ControlPlaneManaged {
		return nil
	}
	sandboxID, err := uuid.Parse(observation.ID)
	if err != nil {
		return fmt.Errorf("parse sandbox ID %q: %w", observation.ID, err)
	}
	present[sandboxID] = struct{}{}
	findings, err := monitor.findings(ctx, sandboxID)
	if err != nil {
		return err
	}
	if len(findings) > 0 {
		report.Sandboxes = append(report.Sandboxes, apiclient.MachineSandboxAbuse{SandboxId: sandboxID, Findings: findings})
	}
	return nil
}

func (monitor *Monitor) findings(ctx context.Context, sandboxID uuid.UUID) ([]apiclient.MachineAbuseFinding, error) {
	sample, err := monitor.runtime.AbuseSample(ctx, sandboxID.String())
	if err != nil {
		return nil, fmt.Errorf("sample sandbox %s: %w", sandboxID, err)
	}
	monitor.connections.observe(sandboxWorkload(sandboxID), sample)
	previous, known := monitor.histories[sandboxID]
	if known {
		return previous.evaluate(sample), nil
	}
	if !monitor.primed {
		monitor.histories[sandboxID] = newHistory(sample)
		return nil, nil
	}
	fresh := newHistory(types.AbuseSample{})
	monitor.histories[sandboxID] = fresh
	return fresh.evaluate(sample), nil
}

func (monitor *Monitor) sampleBuilder(ctx context.Context, observation types.RuntimeObservation, present map[uuid.UUID]struct{}) error {
	builder, err := parseWorkload(observation.ID, observation.BuildTenant)
	if err != nil {
		return err
	}
	present[builder.id] = struct{}{}
	sample, err := monitor.runtime.AbuseSample(ctx, observation.ID)
	if err != nil {
		return fmt.Errorf("sample builder %s: %w", builder.id, err)
	}
	monitor.connections.observe(builder, sample)
	return nil
}
