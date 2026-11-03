// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"errors"
	"path/filepath"

	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/health"
	"github.com/snapflowio/snapflow/internal/jobs"
	"github.com/snapflowio/snapflow/internal/meter"
	"github.com/snapflowio/snapflow/internal/release"
	"github.com/snapflowio/snapflow/internal/sandbox"
	"github.com/snapflowio/snapflow/internal/snapshot"
	"github.com/snapflowio/snapflow/internal/telemetry"
)

const qualificationDirectoryName = "qualification"

func (daemon *Daemon) prepareUsage(ready *foundation, prepared *services) error {
	reporter, err := meter.New(
		meter.Config{Interval: daemon.cfg.Usage.ReportInterval, Parallelism: daemon.cfg.Usage.Parallelism},
		meter.Dependencies{Client: daemon.client, Runtime: prepared.runtime, Identity: ready.identity, Store: ready.database},
		meter.WithLogger(daemon.logger),
	)
	prepared.usage = reporter
	return err
}

func (daemon *Daemon) prepareSnapshots(ready *foundation, prepared *services) error {
	snapshotControl, err := snapshot.NewControlPlane(daemon.client)
	if err != nil {
		return err
	}
	dataDirectory := daemon.cfg.Runtime.DataDirectory
	policy := daemon.cfg.Runtime.Snapshots
	store, err := snapshot.NewStore(
		snapshot.StoreConfig{
			Policy: snapshot.GarbageCollectionPolicy{
				HighThresholdPercent: policy.HighThresholdPercent, LowThresholdPercent: policy.LowThresholdPercent,
				GracePeriod: policy.GracePeriod, Interval: policy.CollectionInterval,
			},
			ReportInterval: daemon.cfg.Health.Interval, RequestTimeout: daemon.cfg.Health.Timeout,
		},
		snapshot.StoreDependencies{
			Runtime: prepared.runtime, Records: ready.database, Control: snapshotControl,
			DiskUsage: func(ctx context.Context) (float64, error) {
				return telemetry.DiskUsagePercent(ctx, dataDirectory)
			},
		},
		snapshot.WithLogger(daemon.logger),
	)
	prepared.snapshots = store
	return err
}

func (daemon *Daemon) prepareConvergence(ready *foundation, prepared *services) error {
	runtimeIdentity := ready.release.Manifest.FileIdentity(release.RoleSnapflowd)
	if runtimeIdentity == "" {
		return errors.New("verified Snapflow release has no Snapflow binary identity")
	}
	prepared.runtimeIdentity = runtimeIdentity
	prepared.localRuntimes = sandbox.NewLocalRuntimes()
	controlPlane, err := sandbox.NewControlPlane(daemon.client)
	if err != nil {
		return err
	}
	metrics, err := sandbox.NewMetrics(prepared.registry)
	if err != nil {
		return err
	}
	prepared.converger, err = sandbox.NewConverger(
		sandbox.ConvergerConfig{RuntimeIdentity: runtimeIdentity, ReleaseIdentity: ready.release.BundleDigest},
		sandbox.ConvergerDependencies{
			Runtime: prepared.runtime, Secrets: controlPlane, Snapshots: prepared.snapshots, Meter: prepared.usage, Metrics: metrics,
		},
	)
	if err != nil {
		return err
	}
	prepared.convergence, err = sandbox.NewManager(
		sandbox.ManagerConfig{ReportInterval: daemon.cfg.Health.Interval, RequestTimeout: daemon.cfg.Health.Timeout},
		sandbox.ManagerDependencies{
			Control: controlPlane, Converger: prepared.converger, Runtime: prepared.runtime, Records: ready.database,
			LocalRuntimes: prepared.localRuntimes, Snapshots: prepared.snapshots, Meter: prepared.usage,
		},
		sandbox.WithLogger(daemon.logger),
	)
	return err
}

func (daemon *Daemon) prepareHealth(prepared *services) error {
	sshHostPublicKey := ""
	if prepared.sshGateway != nil {
		sshHostPublicKey = prepared.sshGateway.PublicHostKey()
	}
	reporter, err := health.New(
		health.Config{
			Interval: daemon.cfg.Health.Interval, Timeout: daemon.cfg.Health.Timeout,
			SSHHostPublicKey: sshHostPublicKey, Version: daemon.options.version,
		},
		health.Dependencies{
			Client: daemon.client, Collector: prepared.metrics, Runtime: prepared.runtime, Inventory: prepared.hostInventory,
		},
		health.WithLogger(daemon.logger),
	)
	prepared.health = reporter
	return err
}

func (daemon *Daemon) prepareJobs(ready *foundation, prepared *services) error {
	outbox, err := jobs.NewOutbox(daemon.client, ready.database, jobs.WithLogger(daemon.logger))
	if err != nil {
		return err
	}
	executor, err := jobs.NewExecutor(
		jobs.ExecutorConfig{
			RuntimeIdentity: prepared.runtimeIdentity, ReleaseIdentity: ready.release.BundleDigest,
			QualificationDirectory: filepath.Join(daemon.cfg.Runtime.DataDirectory, qualificationDirectoryName),
		},
		jobs.ExecutorDependencies{
			Client: daemon.client, Runtime: prepared.runtime, Outbox: outbox,
			LocalRuntimes: prepared.localRuntimes, Converger: prepared.converger, Snapshots: prepared.snapshots,
			Session: ready.session.Credentials(), Identity: ready.identity, HostInventory: prepared.hostInventory,
		},
		jobs.WithLogger(daemon.logger),
	)
	if err != nil {
		return err
	}
	prepared.jobResults = outbox
	prepared.poller, err = jobs.NewPoller(
		jobs.PollerConfig{Timeout: control.LongPollWait, Limit: daemon.cfg.Jobs.PollLimit},
		jobs.PollerDependencies{Client: daemon.client, Executor: executor},
		jobs.WithLogger(daemon.logger),
	)
	return err
}
