package dto

type ExecutorMetrics struct {
	CurrentCpuUsagePercentage    float64 `json:"currentCpuUsagePercentage"`
	CurrentMemoryUsagePercentage float64 `json:"currentMemoryUsagePercentage"`
	CurrentDiskUsagePercentage   float64 `json:"currentDiskUsagePercentage"`
	CurrentAllocatedCpu          int64   `json:"currentAllocatedCpu"`
	CurrentAllocatedMemoryGiB    int64   `json:"currentAllocatedMemoryGiB"`
	CurrentAllocatedDiskGiB      int64   `json:"currentAllocatedDiskGiB"`
	CurrentSnapshotCount         int     `json:"currentSnapshotCount"`
} //	@name	ExecutorMetrics

type ExecutorInfoResponseDTO struct {
	Metrics *ExecutorMetrics `json:"metrics,omitempty"`
} //	@name	ExecutorInfoResponseDTO
