// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import (
	"container/ring"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/readiness"
)

const (
	metricsCollectionTimeout = 30 * time.Second
	metricsRetryInterval     = time.Second
)

type RuntimeSource interface {
	AllocatedResources(context.Context) (microvmtypes.AllocatedResources, error)
	Capacity(context.Context) (microvmtypes.AllocatedResources, error)
	ImageCount(context.Context) (int, error)
	RuntimeInventory(context.Context) ([]microvmtypes.RuntimeObservation, error)
}

type CollectorConfig struct {
	DataDir                            string
	WindowSize                         int
	CPUUsageSnapshotInterval           time.Duration
	AllocatedResourcesSnapshotInterval time.Duration
}

var _ readiness.Collector = (*Collector)(nil)

type Collector struct {
	runtime RuntimeSource
	dataDir string
	log     *slog.Logger

	cpuRing  *ring.Ring
	cpuMutex sync.RWMutex

	resourcesMutex      sync.RWMutex
	allocatedCPU        float32
	allocatedMemoryGiB  float32
	allocatedDiskGiB    float32
	startedSandboxCount float32

	cpuUsageSnapshotInterval           time.Duration
	allocatedResourcesSnapshotInterval time.Duration
}

type CPUSnapshot struct {
	timestamp  time.Time
	cpuPercent float64
}

func NewCollector(cfg CollectorConfig, runtime RuntimeSource, opts ...Option) (*Collector, error) {
	if runtime == nil || cfg.DataDir == "" {
		return nil, errors.New("machine metrics runtime and data directory are required")
	}
	if cfg.WindowSize <= 0 || cfg.CPUUsageSnapshotInterval <= 0 || cfg.AllocatedResourcesSnapshotInterval <= 0 {
		return nil, errors.New("host metrics window size and snapshot intervals must be positive")
	}
	return &Collector{
		log:                                newOptions(opts).logger.With(slog.String("component", "metrics")),
		runtime:                            runtime,
		dataDir:                            cfg.DataDir,
		cpuRing:                            ring.New(cfg.WindowSize),
		cpuUsageSnapshotInterval:           cfg.CPUUsageSnapshotInterval,
		allocatedResourcesSnapshotInterval: cfg.AllocatedResourcesSnapshotInterval,
	}, nil
}

func (c *Collector) Run(ctx context.Context) error {
	var samplers sync.WaitGroup
	samplers.Go(func() { c.snapshotCPUUsage(ctx) })
	samplers.Go(func() { c.snapshotAllocatedResources(ctx) })
	samplers.Wait()
	return nil
}

func (c *Collector) Collect(ctx context.Context) (*readiness.HostMetrics, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, metricsCollectionTimeout)
	defer cancel()

	for {
		select {
		case <-timeoutCtx.Done():
			return nil, errors.New("timeout collecting metrics")
		default:
			metrics, err := c.collect(timeoutCtx)
			if err != nil {
				c.log.DebugContext(ctx, "Failed to collect metrics", "error", err)
				time.Sleep(metricsRetryInterval)
				continue
			}

			return metrics, nil
		}
	}
}

func (c *Collector) collect(ctx context.Context) (*readiness.HostMetrics, error) {
	metrics := &readiness.HostMetrics{}

	cpuCount, err := cpu.CountsWithContext(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to collect CPU count: %w", err)
	}
	loadAvg, err := load.AvgWithContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to collect CPU load averages: %w", err)
	}
	if cpuCount <= 0 {
		return nil, errors.New("host CPU count must be greater than zero")
	}
	metrics.CPULoadAverage = float32(loadAvg.Load15) / float32(cpuCount)

	cpuUsage, err := c.collectCPUUsageAverage()
	if err != nil {
		return nil, fmt.Errorf("failed to collect CPU usage: %w", err)
	}
	metrics.CPUUsagePercentage = float32(cpuUsage)

	memStats, err := mem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to collect memory usage: %w", err)
	}
	metrics.MemoryUsagePercentage = float32(memStats.UsedPercent)

	diskStats, err := disk.UsageWithContext(ctx, c.dataDir)
	if err != nil {
		return nil, fmt.Errorf("failed to collect disk usage: %w", err)
	}
	metrics.DiskUsagePercentage = float32(diskStats.UsedPercent)

	capacity, err := c.runtime.Capacity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get admission capacity: %w", err)
	}
	metrics.CPUCapacity = float32(capacity.CPUVCPUs)
	metrics.MemoryCapacityGiB = float32(capacity.MemoryGiB)
	metrics.DiskCapacityGiB = float32(capacity.DiskGiB)
	metrics.GPUCapacity = int(capacity.GPUCount)

	imageCount, err := c.runtime.ImageCount(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot count: %w", err)
	}
	metrics.SnapshotCount = float32(imageCount)

	c.resourcesMutex.RLock()
	metrics.AllocatedCPU = c.allocatedCPU
	metrics.AllocatedMemoryGiB = c.allocatedMemoryGiB
	metrics.AllocatedDiskGiB = c.allocatedDiskGiB
	metrics.StartedSandboxCount = c.startedSandboxCount
	c.resourcesMutex.RUnlock()

	return metrics, nil
}

func (c *Collector) snapshotCPUUsage(ctx context.Context) {
	ticker := time.NewTicker(c.cpuUsageSnapshotInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			c.log.InfoContext(ctx, "CPU usage snapshotting stopped")
			return
		case <-ticker.C:
			cpuPercent, err := cpu.PercentWithContext(ctx, 0, false)
			if err != nil {
				c.log.WarnContext(ctx, "Failed to collect next CPU usage ring", "error", err)
				continue
			}

			c.cpuMutex.Lock()
			c.cpuRing.Value = CPUSnapshot{
				timestamp:  time.Now(),
				cpuPercent: cpuPercent[0],
			}
			c.cpuRing = c.cpuRing.Next()
			c.cpuMutex.Unlock()
		}
	}
}

func (c *Collector) collectCPUUsageAverage() (float64, error) {
	var total float64
	var count int

	c.cpuMutex.RLock()
	defer c.cpuMutex.RUnlock()

	c.cpuRing.Do(func(x interface{}) {
		if x != nil {
			snapshot, ok := x.(CPUSnapshot)
			if !ok {
				return
			}

			total += snapshot.cpuPercent
			count++
		}
	})

	if count == 0 {
		return -1.0, errors.New("host CPU metrics are not yet available")
	}

	return total / float64(count), nil
}

func (c *Collector) snapshotAllocatedResources(ctx context.Context) {
	ticker := time.NewTicker(c.allocatedResourcesSnapshotInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			c.log.InfoContext(ctx, "Allocated resources snapshotting stopped")
			return
		case <-ticker.C:
			c.recordAllocatedResources(ctx)
		}
	}
}

func (c *Collector) recordAllocatedResources(ctx context.Context) {
	allocated, err := c.runtime.AllocatedResources(ctx)
	if err != nil {
		c.log.ErrorContext(ctx, "Failed to inspect allocated microVM resources", "error", err)
		return
	}
	inventory, err := c.runtime.RuntimeInventory(ctx)
	if err != nil {
		c.log.ErrorContext(ctx, "Failed to inspect microVM inventory", "error", err)
		return
	}
	var startedSandboxCount float32
	for _, observation := range inventory {
		if observation.Info.State == microvmtypes.RuntimeStateStarted {
			startedSandboxCount++
		}
	}

	c.resourcesMutex.Lock()
	c.allocatedCPU = float32(allocated.CPUVCPUs)
	c.allocatedMemoryGiB = float32(allocated.MemoryGiB)
	c.allocatedDiskGiB = float32(allocated.DiskGiB)
	c.startedSandboxCount = startedSandboxCount
	c.resourcesMutex.Unlock()
}
