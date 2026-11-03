// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package localapi

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/snapflow/internal/localapi/contract"
	"github.com/snapflowio/snapflow/internal/readiness"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
)

const (
	healthStatusOK       = "ok"
	serviceHealthTimeout = 2 * time.Second
)

type metricsCollector interface {
	Collect(context.Context) (*readiness.HostMetrics, error)
}

type runtimeHealth interface {
	Health(context.Context) []sandboxruntime.ServiceHealth
}

type controllers struct {
	metrics metricsCollector
	runtime runtimeHealth
	version string
}

// @Summary		Health check
// @Description	Health check
// @Produce		json
// @Success		200	{object}	contract.HealthResponse
// @Router			/ [get]
// @id				HealthCheck
func (controllers *controllers) healthCheck(ctx *echo.Context) error {
	return ctx.JSON(http.StatusOK, contract.HealthResponse{Status: healthStatusOK, Version: controllers.version})
}

// @Summary		Machine info
// @Description	Machine info with system metrics
// @Produce		json
// @Success		200	{object}	MachineInfoResponseDTO
// @Router			/info [get]
// @id				MachineInfo
func (controllers *controllers) machineInfo(ctx *echo.Context) error {
	requestContext := ctx.Request().Context()
	metrics, err := controllers.metrics.Collect(requestContext)
	if err != nil {
		return err
	}
	healthContext, cancel := context.WithTimeout(requestContext, serviceHealthTimeout)
	defer cancel()
	return ctx.JSON(http.StatusOK, MachineInfoResponseDTO{
		ServiceHealth: toServiceInfo(controllers.runtime.Health(healthContext)),
		Metrics: &MachineMetrics{
			CurrentCpuLoadAverage:        float64(metrics.CPULoadAverage),
			CurrentCpuUsagePercentage:    float64(metrics.CPUUsagePercentage),
			CurrentMemoryUsagePercentage: float64(metrics.MemoryUsagePercentage),
			CurrentDiskUsagePercentage:   float64(metrics.DiskUsagePercentage),
			CurrentAllocatedCpu:          float64(metrics.AllocatedCPU),
			CurrentAllocatedMemoryGiB:    float64(metrics.AllocatedMemoryGiB),
			CurrentAllocatedDiskGiB:      float64(metrics.AllocatedDiskGiB),
			CurrentSnapshotCount:         int(metrics.SnapshotCount),
			CurrentStartedSandboxes:      int64(metrics.StartedSandboxCount),
		},
		AppVersion: controllers.version,
	})
}

func toServiceInfo(services []sandboxruntime.ServiceHealth) []*MachineServiceInfo {
	infos := make([]*MachineServiceInfo, 0, len(services))
	for _, service := range services {
		info := &MachineServiceInfo{ServiceName: service.Name, Healthy: service.Healthy}
		if service.Error != nil {
			reason := service.Error.Error()
			info.ErrorReason = &reason
		}
		infos = append(infos, info)
	}
	return infos
}
