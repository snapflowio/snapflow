// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package coderun

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/common"
	"github.com/snapflowio/guest/internal/httpx"
)

const startFailedExitCode = -1

// @Summary		Execute code
// @Description	Execute Python, JavaScript, or TypeScript code and return output, exit code, and artifacts
// @Tags			process
// @Accept			json
// @Produce		json
// @Param			request	body		CodeRunRequest	true	"Code execution request"
// @Success		200		{object}	CodeRunResponse
// @Router			/process/code-run [post]
// @id				CodeRun
func CodeRun(reaper *childreap.Reaper) echo.HandlerFunc {
	return func(c *echo.Context) error {
		var request CodeRunRequest
		if err := httpx.BindBody(c, &request); err != nil {
			return common_errors.NewInvalidBodyRequestError(err)
		}
		toolbox, err := GetToolbox(request.Language)
		if err != nil {
			return common_errors.NewBadRequestError(err)
		}
		if err := common.ValidateEnvKeys(request.Envs); err != nil {
			return common_errors.NewBadRequestError(err)
		}
		script := common.ShellScript{Script: toolbox.GetRunCommand(request.Code, request.Argv), Envs: request.Envs}
		if request.Timeout != nil && *request.Timeout > 0 {
			script.Timeout = time.Duration(*request.Timeout) * time.Second
		}
		result, err := common.RunShellScript(c.Request().Context(), reaper, script)
		if err != nil {
			return c.JSON(http.StatusOK, CodeRunResponse{ExitCode: startFailedExitCode, Result: err.Error()})
		}
		if result.TimedOut {
			return common_errors.NewRequestTimeoutError(errors.New("command execution timeout"))
		}
		output, artifacts := ParseArtifacts(string(result.Output))
		return c.JSON(http.StatusOK, CodeRunResponse{ExitCode: result.ExitCode, Result: output, Artifacts: artifacts})
	}
}
