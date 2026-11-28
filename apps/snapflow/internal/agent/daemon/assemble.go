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
	"github.com/snapflowio/snapflow/internal/agent/abuse"
	"github.com/snapflowio/snapflow/internal/agent/health"
	"github.com/snapflowio/snapflow/internal/agent/hostreport"
	"github.com/snapflowio/snapflow/internal/agent/localapi"
	"github.com/snapflowio/snapflow/internal/agent/telemetry"
	"github.com/snapflowio/snapflow/internal/billing/meter"
	"github.com/snapflowio/snapflow/internal/billing/settlement"
	"github.com/snapflowio/snapflow/internal/network/sshgateway"
	"github.com/snapflowio/snapflow/internal/network/tunnel"
	"github.com/snapflowio/snapflow/internal/workloads/jobs"
	"github.com/snapflowio/snapflow/internal/workloads/runtime/microvm"
	"github.com/snapflowio/snapflow/internal/workloads/sandbox"
	"github.com/snapflowio/snapflow/internal/workloads/snapshot"
)

type services struct {
	engine          *microvm.Engine
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
	hostReports     *hostreport.Reporter
	abuseMonitor    *abuse.Monitor
	hostSettings    *hostSettingsWatcher
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
	steps := []startupStep{
		{PhasePrepareRuntime, func() error { return daemon.prepareRuntime(preparationContext, ready, prepared) }},
		{PhasePrepareSSHGateway, func() error { return daemon.prepareSSHGateway(preparationContext, prepared) }},
		{PhasePrepareTunnels, func() error { return daemon.prepareTunnels(preparationContext, lifecycleContext, ready, prepared) }},
		{PhasePrepareUsage, func() error { return daemon.prepareUsage(ready, prepared) }},
		{PhasePrepareSnapshots, func() error { return daemon.prepareSnapshots(ready, prepared) }},
		{PhasePrepareConvergence, func() error { return daemon.prepareConvergence(ready, prepared) }},
		{PhasePrepareSettlement, func() error { return daemon.prepareSettlement(preparationContext, ready, prepared) }},
		{PhasePrepareHealth, func() error { return daemon.prepareHealth(prepared) }},
		{PhasePrepareHost, func() error { return daemon.prepareHostSettings(ready, prepared) }},
		{PhasePrepareExecutor, func() error { return daemon.prepareJobs(ready, prepared) }},
		{PhasePrepareAPI, func() error { return daemon.prepareAPI(preparationContext, ready, prepared) }},
	}
	if err := daemon.runSteps(steps); err != nil {
		return nil, err
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
	prepared.dataplane.register("build log retention", prepared.buildLogs)
	prepared.intake.register("healthcheck", prepared.health)
	prepared.intake.register("usage reporting", prepared.usage)
	prepared.intake.register("sandbox convergence", prepared.convergence)
	prepared.intake.register("payment vouchers", prepared.settlement)
	prepared.intake.register("host reports", prepared.hostReports)
	prepared.intake.register("abuse monitor", prepared.abuseMonitor)
	prepared.intake.register("host settings", prepared.hostSettings)
	prepared.intake.register("job results", prepared.jobResults)
	prepared.intake.register("job poller", prepared.poller)
}
