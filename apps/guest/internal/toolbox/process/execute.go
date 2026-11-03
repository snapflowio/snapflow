// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package process

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/common-go/pkg/toolboxapi"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/common"
	"github.com/snapflowio/guest/internal/httpx"
)

const startFailedExitCode = -1

// @Summary		Execute a command
// @Description	Execute a shell command and return the output and exit code
// @Tags			process
// @Accept			json
// @Produce		json
// @Param			request	body		toolboxapi.ExecuteRequest	true	"Command execution request"
// @Success		200		{object}	toolboxapi.ExecuteResponse
// @Router			/process/execute [post]
// @id				ExecuteCommand
func ExecuteCommand(reaper *childreap.Reaper) echo.HandlerFunc {
	return func(c *echo.Context) error {
		var request toolboxapi.ExecuteRequest
		if err := httpx.BindBody(c, &request); err != nil {
			return common_errors.NewBadRequestError(fmt.Errorf("invalid request body: %w", err))
		}
		if strings.TrimSpace(request.Command) == "" {
			return common_errors.NewBadRequestError(errors.New("command cannot be empty or whitespace-only"))
		}
		if err := common.ValidateEnvKeys(request.Envs); err != nil {
			return common_errors.NewBadRequestError(err)
		}
		script := common.ShellScript{Script: request.Command, Envs: request.Envs}
		if request.Cwd != nil {
			script.Dir = *request.Cwd
		}
		if request.Timeout != nil && *request.Timeout > 0 {
			script.Timeout = time.Duration(*request.Timeout) * time.Second
		}
		result, err := common.RunShellScript(c.Request().Context(), reaper, script)
		if err != nil {
			return c.JSON(http.StatusOK, toolboxapi.ExecuteResponse{ExitCode: startFailedExitCode, Result: err.Error()})
		}
		if result.TimedOut {
			return common_errors.NewRequestTimeoutError(errors.New("command execution timeout"))
		}
		return c.JSON(http.StatusOK, toolboxapi.ExecuteResponse{ExitCode: result.ExitCode, Result: string(result.Output)})
	}
}
