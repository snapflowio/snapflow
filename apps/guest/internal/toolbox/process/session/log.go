// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"context"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/session"
	"github.com/snapflowio/guest/internal/wsstream"
)

const (
	upgradeHeader    = "Upgrade"
	websocketUpgrade = "websocket"
	followParameter  = "follow"
	followEnabled    = "true"
)

// @Summary		Get session command logs
// @Description	Get logs for a specific command within a session, with stdout and stderr separated. Supports WebSocket streaming.
// @Tags			process
// @Produce		json
// @Param			sessionId	path		string						true	"Session ID"
// @Param			commandId	path		string						true	"Command ID"
// @Param			follow		query		boolean						false	"Follow logs in real-time (WebSocket only)"
// @Success		200			{object}	SessionCommandLogsResponse	"Log content"
// @Router			/process/session/{sessionId}/command/{commandId}/logs [get]
// @id				GetSessionCommandLogs
func (s *SessionController) GetSessionCommandLogs(c *echo.Context) error {
	return s.respondWithLogs(c, c.Param("sessionId"), c.Param("commandId"))
}

// @Summary		Get entrypoint logs
// @Description	Get logs for a sandbox entrypoint session, with stdout and stderr separated. Supports WebSocket streaming.
// @Tags			process
// @Produce		json
// @Param			follow	query		boolean						false	"Follow logs in real-time (WebSocket only)"
// @Success		200		{object}	SessionCommandLogsResponse	"Entrypoint log content"
// @Router			/process/session/entrypoint/logs [get]
// @id				GetEntrypointLogs
func (s *SessionController) GetEntrypointLogs(c *echo.Context) error {
	return s.respondWithLogs(c, session.EntrypointID, session.EntrypointCommand)
}

func (s *SessionController) respondWithLogs(c *echo.Context, sessionID, commandID string) error {
	if c.Request().Header.Get(upgradeHeader) == websocketUpgrade {
		return s.streamLogs(c, sessionID, commandID)
	}
	output, err := s.sessions.CommandLog(sessionID, commandID)
	if err != nil {
		return err
	}
	stdout, stderr := session.Split(output)
	return c.JSON(http.StatusOK, SessionCommandLogsResponse{
		Output: string(output),
		Stdout: string(stdout),
		Stderr: string(stderr),
	})
}

func (s *SessionController) streamLogs(c *echo.Context, sessionID, commandID string) error {
	stream, err := s.sessions.OpenCommandLog(sessionID, commandID)
	if err != nil {
		return err
	}
	conn, err := wsstream.Upgrade(c.Response(), c.Request())
	if err != nil {
		s.logger.Debug("Failed to upgrade the log stream", "error", err)
		return stream.Close()
	}
	ctx, cancel := context.WithCancel(c.Request().Context())
	defer cancel()
	inbound := wsstream.ReadInbound(conn, func(messageType int, payload []byte) {
		s.logger.Debug("Ignored inbound log stream message", "messageType", messageType, "bytes", len(payload))
	})
	go func() {
		select {
		case readErr := <-inbound:
			s.logger.Debug("Log stream client disconnected", "error", readErr)
			cancel()
		case <-ctx.Done():
		}
	}()
	closeCode := websocket.CloseNormalClosure
	if err := stream.Follow(ctx, c.QueryParam(followParameter) == followEnabled, func(data []byte) error {
		return conn.WriteMessage(websocket.BinaryMessage, data)
	}); err != nil {
		s.logger.Debug("Command log stream ended with an error", "error", err)
		closeCode = websocket.CloseInternalServerErr
	}
	if err := wsstream.Close(conn, closeCode, ""); err != nil {
		s.logger.Debug("Failed to close the log stream", "error", err)
	}
	return nil
}
