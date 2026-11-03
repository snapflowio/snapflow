// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package pty

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	cmap "github.com/orcaman/concurrent-map/v2"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/httpx"
	"github.com/snapflowio/guest/internal/wsstream"
)

func NewPTYController(logger *slog.Logger, reaper *childreap.Reaper, workDir string) *PTYController {
	return &PTYController{
		logger:   logger.With(slog.String("component", "PTY_controller")),
		reaper:   reaper,
		workDir:  workDir,
		sessions: NewPTYManager(),
	}
}

func (p *PTYController) sessionInfo(req PTYCreateRequest) (PTYSessionInfo, error) {
	info := PTYSessionInfo{
		ID:        req.ID,
		Cwd:       req.Cwd,
		Envs:      req.Envs,
		Cols:      defaultCols,
		Rows:      defaultRows,
		CreatedAt: time.Now(),
		LazyStart: req.LazyStart,
	}
	if info.Cwd == "" {
		info.Cwd = p.workDir
	}
	if info.Envs == nil {
		info.Envs = make(map[string]string, 1)
	}
	if info.Envs[terminalEnvironment] == "" {
		info.Envs[terminalEnvironment] = defaultTerminal
	}
	if req.Cols != nil {
		info.Cols = *req.Cols
	}
	if req.Rows != nil {
		info.Rows = *req.Rows
	}
	if info.Cols > maximumDimension {
		return info, errors.New("invalid value for cols - must be less than 1000")
	}
	if info.Rows > maximumDimension {
		return info, errors.New("invalid value for rows - must be less than 1000")
	}
	return info, nil
}

// @Summary		Create a new PTY session
// @Description	Create a new pseudo-terminal session with specified configuration
// @Tags			process
// @Accept			json
// @Produce		json
// @Param			request	body		PTYCreateRequest	true	"PTY session creation request"
// @Success		201		{object}	PTYCreateResponse
// @Router			/process/pty [post]
// @id				CreatePtySession
func (p *PTYController) CreatePTYSession(c *echo.Context) error {
	var req PTYCreateRequest
	if err := httpx.BindBody(c, &req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
	}

	if req.ID == "" {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": "session ID is required"})
	}

	info, err := p.sessionInfo(req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
	}
	session := &PTYSession{
		info:     info,
		clients:  cmap.New[*wsClient](),
		logger:   p.logger.With(slog.String("sessionId", req.ID)),
		registry: p.sessions,
		reaper:   p.reaper,
	}

	if !p.sessions.Add(session) {
		return c.JSON(http.StatusConflict, map[string]any{"error": fmt.Sprintf("PTY session with ID '%s' already exists", req.ID)})
	}

	if !req.LazyStart {
		if err := session.start(); err != nil {
			p.sessions.Delete(req.ID)
			p.logger.Error("failed to start PTY at create", "error", err)
			return c.JSON(http.StatusInternalServerError, map[string]any{"error": "failed to start PTY session"})
		}
	}

	return c.JSON(http.StatusCreated, PTYCreateResponse{SessionID: req.ID})
}

// @Summary		List all PTY sessions
// @Description	Get a list of all active pseudo-terminal sessions
// @Tags			process
// @Produce		json
// @Success		200	{object}	PTYListResponse
// @Router			/process/pty [get]
// @id				ListPtySessions
func (p *PTYController) ListPTYSessions(c *echo.Context) error {
	return c.JSON(http.StatusOK, PTYListResponse{Sessions: p.sessions.List()})
}

// @Summary		Get PTY session information
// @Description	Get detailed information about a specific pseudo-terminal session
// @Tags			process
// @Produce		json
// @Param			sessionId	path		string	true	"PTY session ID"
// @Success		200			{object}	PTYSessionInfo
// @Router			/process/pty/{sessionId} [get]
// @id				GetPtySession
func (p *PTYController) GetPTYSession(c *echo.Context) error {
	id := c.Param("sessionId")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": "session ID is required"})
	}

	if s, ok := p.sessions.Get(id); ok {
		return c.JSON(http.StatusOK, s.Info())
	}
	return c.JSON(http.StatusNotFound, map[string]any{"error": "PTY session not found"})
}

// @Summary		Delete a PTY session
// @Description	Delete a pseudo-terminal session and terminate its process
// @Tags			process
// @Produce		json
// @Param			sessionId	path		string	true	"PTY session ID"
// @Success		200			{object}	map[string]any
// @Router			/process/pty/{sessionId} [delete]
// @id				DeletePtySession
func (p *PTYController) DeletePTYSession(c *echo.Context) error {
	id := c.Param("sessionId")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": "session ID is required"})
	}

	if s, ok := p.sessions.Delete(id); ok {
		s.kill()
		p.logger.Debug("Deleted PTY session", "sessionId", id)
		return c.JSON(http.StatusOK, map[string]any{"message": "PTY session deleted"})
	}
	return c.JSON(http.StatusNotFound, map[string]any{"error": "PTY session not found"})
}

// @Summary		Connect to PTY session via WebSocket
// @Description	Establish a WebSocket connection to interact with a pseudo-terminal session
// @Tags			process
// @Param			sessionId	path	string	true	"PTY session ID"
// @Success		101			"Switching Protocols - WebSocket connection established"
// @Router			/process/pty/{sessionId}/connect [get]
// @id				ConnectPtySession
func (p *PTYController) ConnectPTYSession(c *echo.Context) error {
	id := c.Param("sessionId")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": "session ID is required"})
	}

	ws, err := wsstream.Upgrade(c.Response(), c.Request())
	if err != nil {
		p.logger.Error("ws upgrade failed", "error", err)
		return echo.NewHTTPError(http.StatusBadRequest, "websocket upgrade failed").Wrap(err)
	}

	session, err := p.sessions.VerifyPTYSessionReady(id)
	if err != nil {
		p.logger.Debug("failed to connect to PTY session", "sessionId", id, "error", err)
		errorMsg := map[string]interface{}{
			"type":   "control",
			"status": "error",
			"error":  "Failed to connect to PTY session: " + err.Error(),
		}
		errorJSON, marshalErr := json.Marshal(errorMsg)
		if marshalErr != nil {
			return errors.Join(marshalErr, ws.Close())
		}
		return errors.Join(ws.WriteMessage(websocket.TextMessage, errorJSON), ws.Close())
	}

	session.attachWebSocket(ws)
	return nil
}

// @Summary		Resize a PTY session
// @Description	Resize the terminal dimensions of a pseudo-terminal session
// @Tags			process
// @Accept			json
// @Produce		json
// @Param			sessionId	path		string				true	"PTY session ID"
// @Param			request		body		PTYResizeRequest	true	"Resize request with new dimensions"
// @Success		200			{object}	PTYSessionInfo
// @Router			/process/pty/{sessionId}/resize [post]
// @id				ResizePtySession
func (p *PTYController) ResizePTYSession(c *echo.Context) error {
	id := c.Param("sessionId")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": "session ID is required"})
	}

	var req PTYResizeRequest
	if err := httpx.BindBody(c, &req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
	}

	if req.Cols > maximumDimension {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": "cols must be less than 1000"})
	}
	if req.Rows > maximumDimension {
		return c.JSON(http.StatusBadRequest, map[string]any{"error": "rows must be less than 1000"})
	}

	session, err := p.sessions.VerifyPTYSessionForResize(id)
	if err != nil {
		return c.JSON(http.StatusGone, map[string]any{"error": err.Error()})
	}

	if err := session.resize(req.Cols, req.Rows); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"error": err.Error()})
	}
	p.logger.Debug("Resized PTY session", "sessionId", id, "cols", req.Cols, "rows", req.Rows)

	updatedInfo := session.Info()
	return c.JSON(http.StatusOK, updatedInfo)
}
