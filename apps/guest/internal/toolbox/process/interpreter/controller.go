// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package interpreter

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/httpx"
	"github.com/snapflowio/guest/internal/wsstream"
)

func NewInterpreterController(logger *slog.Logger, reaper *childreap.Reaper, workDir string) *Controller {
	logger = logger.With(slog.String("component", "interpreter_controller"))
	return &Controller{logger: logger, workDir: workDir, contexts: NewManager(logger, reaper, workDir)}
}

func (c *Controller) PrewarmDefaultContext(ctx context.Context) {
	go func() {
		defaultContext, err := c.contexts.GetOrCreateDefault(ctx)
		if err != nil {
			c.logger.Debug("Failed to pre-create default interpreter context", "error", err)
			return
		}
		c.logger.Debug("Pre-created default interpreter context", "contextId", defaultContext.Info().ID)
	}()
}

// @Summary		Create a new interpreter context
// @Description	Creates a new isolated interpreter context with optional working directory and language
// @Tags			interpreter
// @Accept			json
// @Produce		json
// @Param			request	body		CreateContextRequest	true	"Context configuration"
// @Success		200		{object}	InterpreterContext
// @Failure		400		{object}	map[string]string
// @Failure		500		{object}	map[string]string
// @Router			/process/interpreter/context [post]
// @id				CreateInterpreterContext
func (c *Controller) CreateContext(ctx *echo.Context) error {
	var req CreateContextRequest
	err := httpx.BindBody(ctx, &req)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Errorf("invalid request payload: %w", err).Error())
	}

	language := LanguagePython
	if req.Language != nil {
		language = *req.Language
	}
	if language != LanguagePython {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Errorf("unsupported language: %s (only '%s' is supported currently)", language, LanguagePython).Error())
	}

	cwd := c.workDir
	if req.Cwd != nil {
		cwd = *req.Cwd
	}

	iCtx, err := c.contexts.Create(ctx.Request().Context(), cwd, language)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	info := iCtx.Info()
	return ctx.JSON(http.StatusOK, ContextInfo{
		ID:        info.ID,
		Cwd:       info.Cwd,
		CreatedAt: info.CreatedAt,
		Active:    info.Active,
		Language:  info.Language,
	})
}

// @Summary		Execute code in an interpreter context
// @Description	Executes code in a specified context (or default context if not specified) via WebSocket streaming
// @Tags			interpreter
// @Accept			json
// @Produce		json
// @Router			/process/interpreter/execute [get]
// @Success		101	{string}	string		"Switching Protocols"
// @Header			101	{string}	Upgrade		"websocket"
// @Header			101	{string}	Connection	"Upgrade"
// @id				ExecuteInterpreterCode
func (c *Controller) Execute(ctx *echo.Context) error {
	ws, err := wsstream.Upgrade(ctx.Response(), ctx.Request())
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "websocket upgrade failed").Wrap(err)
	}
	request, rejection := readExecuteRequest(ws)
	if rejection != nil {
		return writeWSError(ws, rejection.message, rejection.code)
	}
	timeout, rejection := executeTimeout(request)
	if rejection != nil {
		return writeWSError(ws, rejection.message, rejection.code)
	}
	target, rejection := c.resolveContext(ctx.Request().Context(), request)
	if rejection != nil {
		return writeWSError(ws, rejection.message, rejection.code)
	}
	var envs map[string]string
	if request.Envs != nil {
		envs = *request.Envs
	}
	go target.enqueue(execJob{code: request.Code, envs: envs, timeout: timeout, ws: ws})
	return nil
}

type wsRejection struct {
	code    int
	message string
}

func readExecuteRequest(ws *websocket.Conn) (ExecuteRequest, *wsRejection) {
	var request ExecuteRequest
	messageType, payload, err := ws.ReadMessage()
	if err != nil {
		return request, &wsRejection{code: websocket.CloseProtocolError, message: "failed to read first message"}
	}
	if messageType != websocket.TextMessage && messageType != websocket.BinaryMessage {
		return request, &wsRejection{code: websocket.CloseUnsupportedData, message: "first message must contain text or binary JSON"}
	}
	if err := json.Unmarshal(payload, &request); err != nil {
		return request, &wsRejection{code: websocket.CloseProtocolError, message: "invalid JSON payload"}
	}
	if request.Code == "" {
		return request, &wsRejection{code: websocket.ClosePolicyViolation, message: "code is required"}
	}
	return request, nil
}

func executeTimeout(request ExecuteRequest) (time.Duration, *wsRejection) {
	switch {
	case request.Timeout == nil:
		return defaultTimeout, nil
	case *request.Timeout < 0:
		return 0, &wsRejection{code: websocket.ClosePolicyViolation, message: "timeout must be greater than or equal to 0"}
	default:
		return time.Duration(*request.Timeout) * time.Second, nil
	}
}

func (c *Controller) resolveContext(ctx context.Context, request ExecuteRequest) (*Context, *wsRejection) {
	if request.ContextID == nil {
		target, err := c.contexts.GetOrCreateDefault(ctx)
		if err != nil {
			return nil, &wsRejection{code: websocket.CloseInternalServerErr, message: "failed to get default context: " + err.Error()}
		}
		return target, nil
	}
	target, err := c.contexts.Get(ctx, *request.ContextID)
	if err != nil {
		return nil, &wsRejection{code: websocket.ClosePolicyViolation, message: "context not found: " + *request.ContextID}
	}
	if !target.Info().Active {
		return nil, &wsRejection{code: websocket.ClosePolicyViolation, message: "context is not active"}
	}
	return target, nil
}

func writeWSError(ws *websocket.Conn, value string, closeCode int) error {
	return wsstream.Close(ws, closeCode, value)
}

// @Summary		Delete an interpreter context
// @Description	Deletes an interpreter context and shuts down its worker process
// @Tags			interpreter
// @Produce		json
// @Param			id	path		string	true	"Context ID"
// @Success		200	{object}	map[string]string
// @Failure		400	{object}	map[string]string
// @Failure		404	{object}	map[string]string
// @Router			/process/interpreter/context/{id} [delete]
// @id				DeleteInterpreterContext
func (c *Controller) DeleteContext(ctx *echo.Context) error {
	id := ctx.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("context ID is required").Error())
	}

	if id == defaultContextID {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("cannot delete default context").Error())
	}

	err := c.contexts.Delete(id)
	if err != nil {
		if common_errors.IsNotFoundError(err) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return ctx.JSON(http.StatusOK, map[string]any{"message": "Context deleted successfully"})
}

// @Summary		List all user-created interpreter contexts
// @Description	Returns information about all user-created interpreter contexts (excludes default context)
// @Tags			interpreter
// @Produce		json
// @Success		200	{object}	ListContextsResponse
// @Router			/process/interpreter/context [get]
// @id				ListInterpreterContexts
func (c *Controller) ListContexts(ctx *echo.Context) error {
	allContexts := c.contexts.List()

	userContexts := make([]ContextInfo, 0, len(allContexts))
	for _, context := range allContexts {
		if context.ID != defaultContextID {
			userContexts = append(userContexts, context)
		}
	}

	return ctx.JSON(http.StatusOK, ListContextsResponse{Contexts: userContexts})
}
