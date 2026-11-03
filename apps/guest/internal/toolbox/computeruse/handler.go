// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package computeruse

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/computer-use/plugin"
)

const (
	processNameParameter = "processName"
	unknownStatus        = "unknown"
	startedMessage       = "Computer use processes started successfully"
	stoppedMessage       = "Computer use processes stopped successfully"
)

type Handler struct {
	ComputerUse *LazyComputerUse
}

func failure(c *echo.Context, message string, cause error) error {
	return c.JSON(http.StatusServiceUnavailable, map[string]any{"error": message, "details": cause.Error()})
}

func (h *Handler) withComputerUse(c *echo.Context, run func(plugin.ComputerUse) error) error {
	impl, err := h.ComputerUse.Current()
	if err != nil {
		return failure(c, "Computer use is not available", err)
	}
	return run(impl)
}

func (h *Handler) changeState(c *echo.Context, change func(plugin.Lifecycle) (*plugin.Empty, error), action string, respond func(map[string]plugin.ProcessStatus) any) error {
	return h.withComputerUse(c, func(impl plugin.ComputerUse) error {
		if _, err := change(impl); err != nil {
			return failure(c, "Failed to "+action+" computer use", err)
		}
		status, err := impl.GetProcessStatus()
		if err != nil {
			return failure(c, "Failed to get computer use status", err)
		}
		return c.JSON(http.StatusOK, respond(status))
	})
}

// @Summary		Start computer use processes
// @Description	Start all computer use processes and return their status
// @Tags			computer-use
// @Produce		json
// @Success		200	{object}	ComputerUseStartResponse
// @Router			/computeruse/start [post]
// @id				StartComputerUse
func (h *Handler) StartComputerUse(c *echo.Context) error {
	return h.changeState(c, plugin.Lifecycle.Start, "start", func(status map[string]plugin.ProcessStatus) any {
		return ComputerUseStartResponse{Message: startedMessage, Status: status}
	})
}

// @Summary		Stop computer use processes
// @Description	Stop all computer use processes and return their status
// @Tags			computer-use
// @Produce		json
// @Success		200	{object}	ComputerUseStopResponse
// @Router			/computeruse/stop [post]
// @id				StopComputerUse
func (h *Handler) StopComputerUse(c *echo.Context) error {
	return h.changeState(c, plugin.Lifecycle.Stop, "stop", func(status map[string]plugin.ProcessStatus) any {
		return ComputerUseStopResponse{Message: stoppedMessage, Status: status}
	})
}

// @Summary		Get computer use process status
// @Description	Get the status of all computer use processes
// @Tags			computer-use
// @Produce		json
// @Success		200	{object}	plugin.ComputerUseStatusResponse
// @Router			/computeruse/process-status [get]
// @id				GetComputerUseStatus
func (h *Handler) GetComputerUseStatus(c *echo.Context) error {
	status, err := h.ComputerUse.GetStatus()
	if err != nil {
		return failure(c, "Failed to get computer use status", err)
	}
	if status == nil {
		return c.JSON(http.StatusOK, plugin.ComputerUseStatusResponse{Status: unknownStatus})
	}
	return c.JSON(http.StatusOK, status)
}

// @Summary		Get specific process status
// @Description	Check if a specific computer use process is running
// @Tags			computer-use
// @Produce		json
// @Param			processName	path		string	true	"Process name to check"
// @Success		200			{object}	ProcessStatusResponse
// @Router			/computeruse/process/{processName}/status [get]
// @id				GetProcessStatus
func (h *Handler) GetProcessStatus(c *echo.Context) error {
	processName := c.Param(processNameParameter)
	return h.withComputerUse(c, func(impl plugin.ComputerUse) error {
		running, err := impl.IsProcessRunning(&plugin.ProcessRequest{ProcessName: processName})
		if err != nil {
			return failure(c, "Failed to get process status", err)
		}
		return c.JSON(http.StatusOK, ProcessStatusResponse{ProcessName: processName, Running: running})
	})
}

// @Summary		Restart specific process
// @Description	Restart a specific computer use process
// @Tags			computer-use
// @Produce		json
// @Param			processName	path		string	true	"Process name to restart"
// @Success		200			{object}	ProcessRestartResponse
// @Router			/computeruse/process/{processName}/restart [post]
// @id				RestartProcess
func (h *Handler) RestartProcess(c *echo.Context) error {
	processName := c.Param(processNameParameter)
	return h.withComputerUse(c, func(impl plugin.ComputerUse) error {
		if _, err := impl.RestartProcess(&plugin.ProcessRequest{ProcessName: processName}); err != nil {
			return c.JSON(http.StatusBadRequest, errorBody(err.Error()))
		}
		return c.JSON(http.StatusOK, ProcessRestartResponse{
			Message:     fmt.Sprintf("Process %s restarted successfully", processName),
			ProcessName: processName,
		})
	})
}

// @Summary		Get process logs
// @Description	Get logs for a specific computer use process
// @Tags			computer-use
// @Produce		json
// @Param			processName	path		string	true	"Process name to get logs for"
// @Success		200			{object}	ProcessLogsResponse
// @Router			/computeruse/process/{processName}/logs [get]
// @id				GetProcessLogs
func (h *Handler) GetProcessLogs(c *echo.Context) error {
	processName := c.Param(processNameParameter)
	return h.withComputerUse(c, func(impl plugin.ComputerUse) error {
		logs, err := impl.GetProcessLogs(&plugin.ProcessRequest{ProcessName: processName})
		if err != nil {
			return c.JSON(http.StatusBadRequest, errorBody(err.Error()))
		}
		return c.JSON(http.StatusOK, ProcessLogsResponse{ProcessName: processName, Logs: logs})
	})
}

// @Summary		Get process errors
// @Description	Get errors for a specific computer use process
// @Tags			computer-use
// @Produce		json
// @Param			processName	path		string	true	"Process name to get errors for"
// @Success		200			{object}	ProcessErrorsResponse
// @Router			/computeruse/process/{processName}/errors [get]
// @id				GetProcessErrors
func (h *Handler) GetProcessErrors(c *echo.Context) error {
	processName := c.Param(processNameParameter)
	return h.withComputerUse(c, func(impl plugin.ComputerUse) error {
		errorsOutput, err := impl.GetProcessErrors(&plugin.ProcessRequest{ProcessName: processName})
		if err != nil {
			return c.JSON(http.StatusBadRequest, errorBody(err.Error()))
		}
		return c.JSON(http.StatusOK, ProcessErrorsResponse{ProcessName: processName, Errors: errorsOutput})
	})
}
