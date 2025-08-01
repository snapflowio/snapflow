package lsp

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog/log"
)

func Start(c echo.Context) error {
	var req LspServerRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	service := GetLSPService()
	err := service.Start(req.LanguageId, req.PathToProject)
	if err != nil {
		log.Error().Msg(err.Error())
		return echo.NewHTTPError(http.StatusInternalServerError, "error starting LSP server")
	}

	return c.NoContent(http.StatusOK)
}

func Stop(c echo.Context) error {
	var req LspServerRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	service := GetLSPService()
	err := service.Shutdown(req.LanguageId, req.PathToProject)
	if err != nil {
		log.Error().Msg(err.Error())
		return echo.NewHTTPError(http.StatusInternalServerError, "error stopping LSP server")
	}

	return c.NoContent(http.StatusOK)
}

func DidOpen(c echo.Context) error {
	var req LspDocumentRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	service := GetLSPService()
	server, err := service.Get(req.LanguageId, req.PathToProject)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if !server.IsInitialized() {
		return echo.NewHTTPError(http.StatusBadRequest, "server not initialized")
	}
	err = server.HandleDidOpen(c.Request().Context(), req.Uri)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func DidClose(c echo.Context) error {
	var req LspDocumentRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	service := GetLSPService()
	server, err := service.Get(req.LanguageId, req.PathToProject)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if !server.IsInitialized() {
		return echo.NewHTTPError(http.StatusBadRequest, "server not initialized")
	}
	err = server.HandleDidClose(c.Request().Context(), req.Uri)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func Completions(c echo.Context) error {
	var req LspCompletionParams
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	service := GetLSPService()
	server, err := service.Get(req.LanguageId, req.PathToProject)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if !server.IsInitialized() {
		return echo.NewHTTPError(http.StatusBadRequest, "server not initialized")
	}

	textDocument := TextDocumentIdentifier{
		URI: req.Uri,
	}

	completionParams := CompletionParams{
		TextDocument: textDocument,
		Position:     req.Position,
		Context:      req.Context,
	}

	list, err := server.HandleCompletions(c.Request().Context(), completionParams)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, list)
}

func DocumentSymbols(c echo.Context) error {
	languageId := c.QueryParam("languageId")
	if languageId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "languageId is required")
	}

	pathToProject := c.QueryParam("pathToProject")
	if pathToProject == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "pathToProject is required")
	}

	uri := c.QueryParam("uri")
	if uri == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "uri is required")
	}

	service := GetLSPService()
	server, err := service.Get(languageId, pathToProject)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if !server.IsInitialized() {
		return echo.NewHTTPError(http.StatusBadRequest, "server not initialized")
	}

	symbols, err := server.HandleDocumentSymbols(c.Request().Context(), uri)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, symbols)
}

func WorkspaceSymbols(c echo.Context) error {
	query := c.QueryParam("query")
	if query == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "query is required")
	}

	languageId := c.QueryParam("languageId")
	if languageId == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "languageId is required")
	}

	pathToProject := c.QueryParam("pathToProject")
	if pathToProject == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "pathToProject is required")
	}

	service := GetLSPService()
	server, err := service.Get(languageId, pathToProject)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	if !server.IsInitialized() {
		return echo.NewHTTPError(http.StatusBadRequest, "server not initialized")
	}

	symbols, err := server.HandleWorkspaceSymbols(c.Request().Context(), query)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, symbols)
}
