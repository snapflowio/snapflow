// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/httpx"
	"github.com/snapflowio/guest/internal/session"
)

// @Summary		Send input to command
// @Description	Send input data to a running command in a session for interactive execution
// @Tags			process
// @Accept			json
// @Param			sessionId	path	string					true	"Session ID"
// @Param			commandId	path	string					true	"Command ID"
// @Param			request		body	SessionSendInputRequest	true	"Input send request"
// @Success		204
// @Router			/process/session/{sessionId}/command/{commandId}/input [post]
// @id				SendInput
func (s *SessionController) SendInput(c *echo.Context) error {
	sessionId := c.Param("sessionId")
	commandId := c.Param("commandId")

	if sessionId == session.EntrypointID {
		return common_errors.NewBadRequestError(errors.New("can't send input to entrypoint session"))
	}

	var request SessionSendInputRequest
	if err := httpx.BindBody(c, &request); err != nil {
		return common_errors.NewInvalidBodyRequestError(err)
	}

	err := s.sessions.SendInput(sessionId, commandId, request.Data)
	if err != nil {
		return err
	}

	return c.NoContent(http.StatusNoContent)
}
