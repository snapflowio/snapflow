// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package localapi

type MachineMetrics struct {
	CurrentCpuLoadAverage        float64 `json:"currentCpuLoadAverage"`
	CurrentCpuUsagePercentage    float64 `json:"currentCpuUsagePercentage"`
	CurrentMemoryUsagePercentage float64 `json:"currentMemoryUsagePercentage"`
	CurrentDiskUsagePercentage   float64 `json:"currentDiskUsagePercentage"`
	CurrentAllocatedCpu          float64 `json:"currentAllocatedCpu"`
	CurrentAllocatedMemoryGiB    float64 `json:"currentAllocatedMemoryGiB"`
	CurrentAllocatedDiskGiB      float64 `json:"currentAllocatedDiskGiB"`
	CurrentSnapshotCount         int     `json:"currentSnapshotCount"`
	CurrentStartedSandboxes      int64   `json:"currentStartedSandboxes"`
} //	@name	MachineMetrics

type MachineServiceInfo struct {
	ServiceName string  `json:"serviceName" validate:"required"`
	Healthy     bool    `json:"healthy" validate:"required"`
	ErrorReason *string `json:"errorReason,omitempty"`
} //	@name	MachineServiceInfo

type MachineInfoResponseDTO struct {
	ServiceHealth []*MachineServiceInfo `json:"serviceHealth,omitempty"`
	Metrics       *MachineMetrics       `json:"metrics,omitempty"`
	AppVersion    string                `json:"appVersion"`
} //	@name	MachineInfoResponseDTO
