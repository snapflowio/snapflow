package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog/log"
	"github.com/snapflowio/executor/pkg/common"
)

func ProxyCommandLogsStream(c echo.Context) error {
	target, err := getProxyTarget(c)
	if err != nil {
		return err
	}

	// Build WebSocket URL
	path := c.Param("*")
	if path == "" {
		path = "/"
	} else if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	wsURL := fmt.Sprintf("ws://%s%s", target.Host, path)
	if c.Request().URL.RawQuery != "" {
		wsURL = fmt.Sprintf("%s?%s", wsURL, c.Request().URL.RawQuery)
	}

	// Connect to backend WebSocket
	ws, _, err := websocket.DefaultDialer.DialContext(c.Request().Context(), wsURL, nil)
	if err != nil {
		return common.NewBadRequestError(fmt.Errorf("failed to create outgoing request: %w", err))
	}
	defer ws.Close()

	c.Response().Header().Set("Content-Type", "application/octet-stream")

	ws.SetCloseHandler(func(code int, text string) error {
		c.Response().WriteHeader(code)
		return nil
	})

	// Read from WebSocket and write to HTTP response
	go func() {
		for {
			_, msg, err := ws.ReadMessage()
			if err != nil {
				log.Error().Err(err).Msg("Error reading message")
				ws.Close()
				return
			}

			_, err = c.Response().Writer.Write(msg)
			if err != nil {
				log.Error().Err(err).Msg("Error writing message")
				ws.Close()
				return
			}

			if flusher, ok := c.Response().Writer.(http.Flusher); ok {
				flusher.Flush()
			}
		}
	}()

	<-c.Request().Context().Done()
	return nil
}
