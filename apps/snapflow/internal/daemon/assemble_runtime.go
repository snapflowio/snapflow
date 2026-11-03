// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"fmt"

	"github.com/snapflowio/snapflow/internal/runtime/microvm"
	"github.com/snapflowio/snapflow/internal/telemetry"
)

func (daemon *Daemon) prepareRuntime(ctx context.Context, ready *foundation, prepared *services) error {
	runtimeConfig := daemon.cfg.Runtime
	buildLogs, err := telemetry.NewBuildLogStore(runtimeConfig.DataDirectory)
	if err != nil {
		return fmt.Errorf("initialize build log storage: %w", err)
	}
	hostGPU, hostInventory := daemon.options.platform.probeHost(ctx)
	prepared.hostInventory = hostInventory
	engine, err := daemon.options.platform.openRuntime(ctx, microvm.EngineConfig{
		DataDir: runtimeConfig.DataDirectory, Release: ready.release,
		GuestRegistryURL:     ready.policy.GuestRegistryURL,
		DesktopEnabled:       ready.policy.DesktopEnabled,
		SerialConsoleEnabled: ready.policy.SerialConsoleEnabled,
		HostServicePorts:     runtimeConfig.HostServicePorts,
		TemplateCacheEntries: runtimeConfig.Cache.MaximumEntries,
		TemplateCacheBytes:   runtimeConfig.Cache.MaximumBytes,
		TemplateBuildLimit:   runtimeConfig.Build.Parallelism,
		Offer: microvm.Offer{
			CPUVCPUs: runtimeConfig.OfferedVCPUs, MemoryGiB: runtimeConfig.OfferedMemoryGiB, DiskGiB: runtimeConfig.OfferedDiskGiB,
		},
		TrustedTransferOrigins: daemon.cfg.Profile.TrustedObjectStorageOrigins,
		BuildLogPath:           buildLogs.Path,
		Preflight:              ready.preflight,
		HostGPU:                hostGPU,
	})
	if err != nil {
		return fmt.Errorf("initialize microVM workload runtime: %w", err)
	}
	prepared.engine, prepared.runtime, prepared.buildLogs = engine, engine.Runtime(), buildLogs
	metrics, err := telemetry.NewCollector(
		telemetry.CollectorConfig{
			DataDir:                            runtimeConfig.DataDirectory,
			WindowSize:                         daemon.cfg.Metrics.WindowSize,
			CPUUsageSnapshotInterval:           daemon.cfg.Metrics.CPUUsageInterval,
			AllocatedResourcesSnapshotInterval: daemon.cfg.Metrics.AllocatedResourcesInterval,
		},
		prepared.runtime,
		telemetry.WithLogger(daemon.logger),
	)
	if err != nil {
		return fmt.Errorf("initialize host metrics: %w", err)
	}
	prepared.metrics = metrics
	return nil
}
