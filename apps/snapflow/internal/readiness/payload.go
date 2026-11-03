// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package readiness

import (
	"context"
	"errors"
	"fmt"
	"strings"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const maximumReasonLength = 1024

type Runtime interface {
	Health(context.Context) []sandboxruntime.ServiceHealth
	Capabilities(context.Context) (sandboxruntime.Capabilities, error)
}

type PayloadConfig struct {
	State            apiclient.MachineReadinessState
	Reason           string
	Version          string
	Runtime          Runtime
	Collector        Collector
	SSHHostPublicKey string
	InventoryDigest  string
}

type HostMetrics struct {
	CPULoadAverage        float32
	CPUUsagePercentage    float32
	MemoryUsagePercentage float32
	DiskUsagePercentage   float32
	AllocatedCPU          float32
	AllocatedMemoryGiB    float32
	AllocatedDiskGiB      float32
	SnapshotCount         float32
	CPUCapacity           float32
	MemoryCapacityGiB     float32
	DiskCapacityGiB       float32
	GPUCapacity           int
	StartedSandboxCount   float32
}

type Collector interface {
	Collect(context.Context) (*HostMetrics, error)
}

func BuildPayload(ctx context.Context, cfg PayloadConfig) (apiclient.MachineHealthcheck, error) {
	if cfg.Runtime == nil {
		return apiclient.MachineHealthcheck{}, errors.New("sandbox runtime is required")
	}
	if cfg.Collector == nil {
		return apiclient.MachineHealthcheck{}, errors.New("metrics collector is required")
	}
	payload := Healthcheck(cfg.Version, cfg.State, cfg.Reason)
	payload.SshHostPublicKey = optional(cfg.SSHHostPublicKey)
	payload.InventoryDigest = optional(cfg.InventoryDigest)

	serviceHealth := cfg.Runtime.Health(ctx)
	health := make([]apiclient.MachineServiceHealth, 0, len(serviceHealth))
	for _, service := range serviceHealth {
		item := apiclient.MachineServiceHealth{ServiceName: service.Name, Healthy: service.Healthy}
		if service.Error != nil {
			reason := service.Error.Error()
			item.ErrorReason = &reason
		}
		health = append(health, item)
	}
	payload.ServiceHealth = &health

	capabilities, err := cfg.Runtime.Capabilities(ctx)
	if err != nil {
		return apiclient.MachineHealthcheck{}, fmt.Errorf("collect runtime capabilities: %w", err)
	}
	apiCapabilities, err := toAPICapabilities(capabilities)
	if err != nil {
		return apiclient.MachineHealthcheck{}, err
	}
	payload.RuntimeCapabilities = &apiCapabilities

	measurement, err := cfg.Collector.Collect(ctx)
	if err != nil {
		return apiclient.MachineHealthcheck{}, fmt.Errorf("collect machine metrics: %w", err)
	}
	payload.Metrics = &apiclient.MachineHealthMetrics{
		CurrentCpuUsagePercentage:    measurement.CPUUsagePercentage,
		CurrentMemoryUsagePercentage: measurement.MemoryUsagePercentage,
		CurrentDiskUsagePercentage:   measurement.DiskUsagePercentage,
		CurrentAllocatedCpu:          measurement.AllocatedCPU,
		CurrentAllocatedMemoryGiB:    measurement.AllocatedMemoryGiB,
		CurrentAllocatedDiskGiB:      measurement.AllocatedDiskGiB,
		CurrentSnapshotCount:         measurement.SnapshotCount,
		CurrentStartedSandboxes:      measurement.StartedSandboxCount,
		Cpu:                          measurement.CPUCapacity,
		MemoryGiB:                    measurement.MemoryCapacityGiB,
		DiskGiB:                      measurement.DiskCapacityGiB,
		PassthroughGpuCount:          measurement.GPUCapacity,
	}
	return payload, nil
}

func Healthcheck(version string, state apiclient.MachineReadinessState, reason string) apiclient.MachineHealthcheck {
	return apiclient.MachineHealthcheck{
		AppVersion: version,
		Readiness:  apiclient.MachineReadiness{State: state, Reason: optional(boundedReason(reason))},
	}
}

func boundedReason(reason string) string {
	runes := []rune(strings.TrimSpace(reason))
	if len(runes) <= maximumReasonLength {
		return string(runes)
	}
	return string(runes[:maximumReasonLength])
}
