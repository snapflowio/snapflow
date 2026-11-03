// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package computeruse

import "github.com/snapflowio/computer-use/plugin"

type ComputerUseStartResponse struct {
	Message string                          `json:"message"`
	Status  map[string]plugin.ProcessStatus `json:"status"`
} //	@name	ComputerUseStartResponse

type ComputerUseStopResponse struct {
	Message string                          `json:"message"`
	Status  map[string]plugin.ProcessStatus `json:"status"`
} //	@name	ComputerUseStopResponse

type ProcessStatusResponse struct {
	ProcessName string `json:"processName"`
	Running     bool   `json:"running"`
} //	@name	ProcessStatusResponse

type ProcessRestartResponse struct {
	Message     string `json:"message"`
	ProcessName string `json:"processName"`
} //	@name	ProcessRestartResponse

type ProcessLogsResponse struct {
	ProcessName string `json:"processName"`
	Logs        string `json:"logs"`
} //	@name	ProcessLogsResponse

type ProcessErrorsResponse struct {
	ProcessName string `json:"processName"`
	Errors      string `json:"errors"`
} //	@name	ProcessErrorsResponse
