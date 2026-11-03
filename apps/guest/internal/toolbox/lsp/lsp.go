// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package lsp

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/httpx"
)

const (
	languageIDParameter    = "languageId"
	pathToProjectParameter = "pathToProject"
	uriParameter           = "uri"
	queryParameter         = "query"
)

type Controller struct {
	logger  *slog.Logger
	service *Service
}

func NewController(logger *slog.Logger) *Controller {
	logger = logger.With(slog.String("component", "lsp_service"))
	return &Controller{logger: logger, service: NewService(logger)}
}

func bindBody[T any](c *echo.Context) (T, error) {
	var request T
	if err := httpx.BindBody(c, &request); err != nil {
		return request, echo.NewHTTPError(http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err).Error())
	}
	return request, nil
}

func requiredQuery(c *echo.Context, names ...string) (map[string]string, error) {
	values := make(map[string]string, len(names))
	for _, name := range names {
		value := c.QueryParam(name)
		if value == "" {
			return nil, echo.NewHTTPError(http.StatusBadRequest, name+" is required")
		}
		values[name] = value
	}
	return values, nil
}

func (l *Controller) client(languageID, pathToProject string) (*Client, error) {
	client, err := l.service.Client(languageID, pathToProject)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return client, nil
}

// @Summary		Start LSP server
// @Description	Start a Language Server Protocol server for the specified language
// @Tags			lsp
// @Accept			json
// @Produce		json
// @Param			request	body	LspServerRequest	true	"LSP server request"
// @Success		200
// @Router			/lsp/start [post]
// @id				Start
func (l *Controller) Start(c *echo.Context) error {
	request, err := bindBody[LspServerRequest](c)
	if err != nil {
		return err
	}
	if err := l.service.Start(c.Request().Context(), request.LanguageId, request.PathToProject); err != nil {
		l.logger.Error("error starting LSP server", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, errors.New("error starting LSP server").Error())
	}
	return c.NoContent(http.StatusOK)
}

// @Summary		Stop LSP server
// @Description	Stop a Language Server Protocol server
// @Tags			lsp
// @Accept			json
// @Produce		json
// @Param			request	body	LspServerRequest	true	"LSP server request"
// @Success		200
// @Router			/lsp/stop [post]
// @id				Stop
func (l *Controller) Stop(c *echo.Context) error {
	request, err := bindBody[LspServerRequest](c)
	if err != nil {
		return err
	}
	if err := l.service.Shutdown(c.Request().Context(), request.LanguageId, request.PathToProject); err != nil {
		l.logger.Error("error stopping LSP server", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, errors.New("error stopping LSP server").Error())
	}
	return c.NoContent(http.StatusOK)
}

// @Summary		Notify document opened
// @Description	Notify the LSP server that a document has been opened
// @Tags			lsp
// @Accept			json
// @Produce		json
// @Param			request	body	LspDocumentRequest	true	"Document request"
// @Success		200
// @Router			/lsp/did-open [post]
// @id				DidOpen
func (l *Controller) DidOpen(c *echo.Context) error {
	request, err := bindBody[LspDocumentRequest](c)
	if err != nil {
		return err
	}
	client, err := l.client(request.LanguageId, request.PathToProject)
	if err != nil {
		return err
	}
	if err := client.DidOpen(c.Request().Context(), request.Uri, request.LanguageId); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

// @Summary		Notify document closed
// @Description	Notify the LSP server that a document has been closed
// @Tags			lsp
// @Accept			json
// @Produce		json
// @Param			request	body	LspDocumentRequest	true	"Document request"
// @Success		200
// @Router			/lsp/did-close [post]
// @id				DidClose
func (l *Controller) DidClose(c *echo.Context) error {
	request, err := bindBody[LspDocumentRequest](c)
	if err != nil {
		return err
	}
	client, err := l.client(request.LanguageId, request.PathToProject)
	if err != nil {
		return err
	}
	if err := client.NotifyDidClose(c.Request().Context(), request.Uri); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.NoContent(http.StatusOK)
}

// @Summary		Get code completions
// @Description	Get code completion suggestions from the LSP server
// @Tags			lsp
// @Accept			json
// @Produce		json
// @Param			request	body		LspCompletionParams	true	"Completion request"
// @Success		200		{object}	CompletionList
// @Router			/lsp/completions [post]
// @id				Completions
func (l *Controller) Completions(c *echo.Context) error {
	request, err := bindBody[LspCompletionParams](c)
	if err != nil {
		return err
	}
	client, err := l.client(request.LanguageId, request.PathToProject)
	if err != nil {
		return err
	}
	list, err := client.GetCompletion(c.Request().Context(), CompletionParams{
		TextDocument: TextDocumentIdentifier{URI: request.Uri},
		Position:     request.Position,
		Context:      request.Context,
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, list)
}

// @Summary		Get document symbols
// @Description	Get symbols (functions, classes, etc.) from a document
// @Tags			lsp
// @Produce		json
// @Param			languageId		query	string	true	"Language ID (e.g., python, typescript)"
// @Param			pathToProject	query	string	true	"Path to project"
// @Param			uri				query	string	true	"Document URI"
// @Success		200				{array}	LspSymbol
// @Router			/lsp/document-symbols [get]
// @id				DocumentSymbols
func (l *Controller) DocumentSymbols(c *echo.Context) error {
	values, err := requiredQuery(c, languageIDParameter, pathToProjectParameter, uriParameter)
	if err != nil {
		return err
	}
	client, err := l.client(values[languageIDParameter], values[pathToProjectParameter])
	if err != nil {
		return err
	}
	symbols, err := client.GetDocumentSymbols(c.Request().Context(), values[uriParameter])
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, symbols)
}

// @Summary		Get workspace symbols
// @Description	Search for symbols across the entire workspace
// @Tags			lsp
// @Produce		json
// @Param			query			query	string	true	"Search query"
// @Param			languageId		query	string	true	"Language ID (e.g., python, typescript)"
// @Param			pathToProject	query	string	true	"Path to project"
// @Success		200				{array}	LspSymbol
// @Router			/lsp/workspacesymbols [get]
// @id				WorkspaceSymbols
func (l *Controller) WorkspaceSymbols(c *echo.Context) error {
	values, err := requiredQuery(c, queryParameter, languageIDParameter, pathToProjectParameter)
	if err != nil {
		return err
	}
	client, err := l.client(values[languageIDParameter], values[pathToProjectParameter])
	if err != nil {
		return err
	}
	symbols, err := client.GetWorkspaceSymbols(c.Request().Context(), values[queryParameter])
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusOK, symbols)
}
