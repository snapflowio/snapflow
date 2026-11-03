// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/httpx"
	"github.com/snapflowio/guest/internal/session"
)

// @Summary		Execute command in session
// @Description	Execute a command within an existing shell session
// @Tags			process
// @Accept			json
// @Produce		json
// @Param			sessionId	path		string					true	"Session ID"
// @Param			request		body		SessionExecuteRequest	true	"Command execution request"
// @Success		200			{object}	SessionExecuteResponse
// @Success		202			{object}	SessionExecuteResponse
// @Router			/process/session/{sessionId}/exec [post]
// @id				SessionExecuteCommand
func (s *SessionController) SessionExecuteCommand(c *echo.Context) error {
	sessionId := c.Param("sessionId")

	if sessionId == session.EntrypointID {
		return common_errors.NewBadRequestError(errors.New("can't execute command in entrypoint session"))
	}

	var request SessionExecuteRequest
	if err := httpx.BindBody(c, &request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err).Error())
	}

	if strings.TrimSpace(request.Command) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("command cannot be empty").Error())
	}

	executeResult, err := s.sessions.Execute(c.Request().Context(), sessionId, "", request.Command, request.RunAsync, request.SuppressInputEcho)
	if err != nil {
		return fmt.Errorf("failed to execute command: %w", err)
	}

	if request.RunAsync {
		return c.JSON(http.StatusAccepted, &SessionExecuteResponse{
			CommandId: executeResult.CommandID,
		})
	}

	return c.JSON(http.StatusOK, &SessionExecuteResponse{
		CommandId: executeResult.CommandID,
		Output:    &executeResult.Output,
		Stdout:    &executeResult.Stdout,
		Stderr:    &executeResult.Stderr,
		ExitCode:  &executeResult.ExitCode,
	})
}
