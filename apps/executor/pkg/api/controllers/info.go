package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/snapflowio/executor/pkg/api/dto"
	"github.com/snapflowio/executor/pkg/executor"
)

// ExecutorInfo 			godoc
//
//	@Summary		Executor info
//	@Description	Executor info with system metrics
//	@Produce		json
//	@Success		200	{object}	dto.ExecutorInfoResponseDTO
//	@Router			/info [get]
//
//	@id				ExecutorInfo
func ExecutorInfo(ctx *gin.Context) {
	executorInstance := executor.GetInstance(nil)

	// Get cached system metrics
	cpuUsage, ramUsage, diskUsage, allocatedCpu, allocatedMemory, allocatedDisk, snapshotCount := executorInstance.MetricsService.GetCachedSystemMetrics(ctx.Request.Context())

	// Create metrics object
	metrics := &dto.ExecutorMetrics{
		CurrentCpuUsagePercentage:    cpuUsage,
		CurrentMemoryUsagePercentage: ramUsage,
		CurrentDiskUsagePercentage:   diskUsage,
		CurrentAllocatedCpu:          allocatedCpu,
		CurrentAllocatedMemoryGiB:    allocatedMemory,
		CurrentAllocatedDiskGiB:      allocatedDisk,
		CurrentSnapshotCount:         snapshotCount,
	}

	response := dto.ExecutorInfoResponseDTO{
		Metrics: metrics,
	}

	ctx.JSON(http.StatusOK, response)
}
