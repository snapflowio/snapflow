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

// @Summary		Create a new session
// @Description	Create a new shell session for command execution
// @Tags			process
// @Accept			json
// @Produce		json
// @Param			request	body	CreateSessionRequest	true	"Session creation request"
// @Success		201
// @Router			/process/session [post]
// @id				CreateSession
func (s *SessionController) CreateSession(c *echo.Context) error {
	var request CreateSessionRequest
	if err := httpx.BindBody(c, &request); err != nil {
		return common_errors.NewInvalidBodyRequestError(err)
	}

	if request.SessionId == session.EntrypointID {
		return common_errors.NewBadRequestError(errors.New("provided session ID is reserved and cannot be created/overridden"))
	}

	err := s.sessions.Create(c.Request().Context(), request.SessionId)
	if err != nil {
		return err
	}

	return c.NoContent(http.StatusCreated)
}

// @Summary		Delete a session
// @Description	Delete an existing shell session
// @Tags			process
// @Param			sessionId	path	string	true	"Session ID"
// @Success		204
// @Router			/process/session/{sessionId} [delete]
// @id				DeleteSession
func (s *SessionController) DeleteSession(c *echo.Context) error {
	sessionId := c.Param("sessionId")

	if sessionId == session.EntrypointID {
		return common_errors.NewBadRequestError(errors.New("can't delete entrypoint session"))
	}

	err := s.sessions.Delete(c.Request().Context(), sessionId)
	if err != nil {
		return err
	}

	return c.NoContent(http.StatusNoContent)
}

// @Summary		List all sessions
// @Description	Get a list of all active shell sessions
// @Tags			process
// @Produce		json
// @Success		200	{array}	SessionDTO
// @Router			/process/session [get]
// @id				ListSessions
func (s *SessionController) ListSessions(c *echo.Context) error {
	sessions, err := s.sessions.List()
	if err != nil {
		return err
	}

	sessionDTOs := make([]SessionDTO, 0, len(sessions))
	for index := range sessions {
		sessionDTOs = append(sessionDTOs, *SessionToDTO(&sessions[index]))
	}

	return c.JSON(http.StatusOK, sessionDTOs)
}

// @Summary		Get session details
// @Description	Get details of a specific session including its commands
// @Tags			process
// @Produce		json
// @Param			sessionId	path		string	true	"Session ID"
// @Success		200			{object}	SessionDTO
// @Router			/process/session/{sessionId} [get]
// @id				GetSession
func (s *SessionController) GetSession(c *echo.Context) error {
	sessionId := c.Param("sessionId")

	found, err := s.sessions.Get(sessionId)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, SessionToDTO(found))
}

// @Summary		Get session command details
// @Description	Get details of a specific command within a session
// @Tags			process
// @Produce		json
// @Param			sessionId	path		string	true	"Session ID"
// @Param			commandId	path		string	true	"Command ID"
// @Success		200			{object}	CommandDTO
// @Router			/process/session/{sessionId}/command/{commandId} [get]
// @id				GetSessionCommand
func (s *SessionController) GetSessionCommand(c *echo.Context) error {
	sessionId := c.Param("sessionId")
	cmdId := c.Param("commandId")

	command, err := s.sessions.GetCommand(sessionId, cmdId)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, CommandToDTO(command))
}

// @Summary		Get entrypoint session details
// @Description	Get details of an entrypoint session including its commands
// @Tags			process
// @Produce		json
// @Success		200	{object}	SessionDTO
// @Router			/process/session/entrypoint [get]
// @id				GetEntrypointSession
func (s *SessionController) GetEntrypointSession(c *echo.Context) error {
	found, err := s.sessions.Get(session.EntrypointID)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, SessionToDTO(found))
}
