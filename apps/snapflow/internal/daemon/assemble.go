// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/snapflowio/snapflow/internal/health"
	"github.com/snapflowio/snapflow/internal/jobs"
	"github.com/snapflowio/snapflow/internal/localapi"
	"github.com/snapflowio/snapflow/internal/meter"
	"github.com/snapflowio/snapflow/internal/sandbox"
	"github.com/snapflowio/snapflow/internal/settlement"
	"github.com/snapflowio/snapflow/internal/snapshot"
	"github.com/snapflowio/snapflow/internal/sshgateway"
	"github.com/snapflowio/snapflow/internal/telemetry"
	"github.com/snapflowio/snapflow/internal/tunnel"
)

type services struct {
	engine          Engine
	runtime         Runtime
	buildLogs       *telemetry.BuildLogStore
	metrics         *telemetry.Collector
	registry        *prometheus.Registry
	sshGateway      *sshgateway.Service
	tunnels         *tunnel.Manager
	api             *localapi.Server
	usage           *meter.Reporter
	snapshots       *snapshot.Store
	convergence     *sandbox.Manager
	converger       *sandbox.Converger
	jobResults      *jobs.Outbox
	localRuntimes   *sandbox.LocalRuntimes
	paymentHolds    *sandbox.PaymentHolds
	settlement      *settlement.Service
	runtimeIdentity string
	health          *health.Reporter
	poller          *jobs.Poller
	hostInventory   HostInventory
	dataplane       componentSet
	intake          componentSet
}

func (daemon *Daemon) assemble(
	preparationContext context.Context,
	lifecycleContext context.Context,
	ready *foundation,
) (*services, error) {
	prepared := &services{registry: prometheus.NewRegistry()}
	if err := prepared.registry.Register(collectors.NewGoCollector()); err != nil {
		return nil, err
	}
	if err := prepared.registry.Register(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{})); err != nil {
		return nil, err
	}
	steps := []struct {
		phase   Phase
		prepare func() error
	}{
		{PhasePrepareRuntime, func() error { return daemon.prepareRuntime(preparationContext, ready, prepared) }},
		{PhasePrepareSSHGateway, func() error { return daemon.prepareSSHGateway(preparationContext, prepared) }},
		{PhasePrepareTunnels, func() error { return daemon.prepareTunnels(preparationContext, lifecycleContext, ready, prepared) }},
		{PhasePrepareUsage, func() error { return daemon.prepareUsage(ready, prepared) }},
		{PhasePrepareSnapshots, func() error { return daemon.prepareSnapshots(ready, prepared) }},
		{PhasePrepareConvergence, func() error { return daemon.prepareConvergence(ready, prepared) }},
		{PhasePrepareSettlement, func() error { return daemon.prepareSettlement(preparationContext, ready, prepared) }},
		{PhasePrepareHealth, func() error { return daemon.prepareHealth(prepared) }},
		{PhasePrepareExecutor, func() error { return daemon.prepareJobs(ready, prepared) }},
		{PhasePrepareAPI, func() error { return daemon.prepareAPI(preparationContext, ready, prepared) }},
	}
	for _, step := range steps {
		if err := step.prepare(); err != nil {
			return nil, phaseError(step.phase, err)
		}
	}
	prepared.register(ready)
	return prepared, nil
}

func (prepared *services) register(ready *foundation) {
	prepared.dataplane.register("machine session", ready.session)
	prepared.dataplane.register("control policy", ready.policies)
	prepared.dataplane.register("Edge tunnels", prepared.tunnels)
	if prepared.sshGateway != nil {
		prepared.dataplane.register("SSH gateway", prepared.sshGateway)
	}
	prepared.dataplane.register("Snapflow API", prepared.api)
	prepared.dataplane.register("microVM supervision", prepared.engine)
	prepared.dataplane.register("snapshot inventory", prepared.snapshots)
	prepared.dataplane.register("host metrics", prepared.metrics)
	prepared.intake.register("healthcheck", prepared.health)
	prepared.intake.register("usage reporting", prepared.usage)
	prepared.intake.register("sandbox convergence", prepared.convergence)
	prepared.intake.register("payment vouchers", prepared.settlement)
	prepared.intake.register("job results", prepared.jobResults)
	prepared.intake.register("job poller", prepared.poller)
}
