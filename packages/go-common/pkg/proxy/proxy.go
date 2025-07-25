package proxy

import (
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	common_errors "github.com/snapflow/go-common/pkg/errors"

	log "github.com/sirupsen/logrus"
)

var proxyTransport = &http.Transport{
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 100,
	DialContext: (&net.Dialer{
		KeepAlive: 30 * time.Second,
	}).DialContext,
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var proxyClient = &http.Client{
	Transport: proxyTransport,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) > 0 {
			for key, values := range via[0].Header {
				if key != "Cookie" {
					for _, value := range values {
						req.Header.Add(key, value)
					}
				}
			}
		}

		if len(via) >= 10 {
			return errors.New("stopped after 10 redirects")
		}

		return nil
	},
}

// ProxyRequest handles proxying requests to a sandbox's container
//
// @Tags toolbox
// @Summary Proxy requests to the sandbox toolbox
// @Description Forwards the request to the specified sandbox's container
// @Param workspaceId path string true "Sandbox ID"
// @Param projectId path string true "Project ID"
// @Param path path string true "Path to forward"
// @Success 200 {object} string "Proxied response"
// @Failure 400 {object} string "Bad request"
// @Failure 401 {object} string "Unauthorized"
// @Failure 404 {object} string "Sandbox container not found"
// @Failure 409 {object} string "Sandbox container conflict"
// @Failure 500 {object} string "Internal server error"
// @Router /workspaces/{workspaceId}/{projectId}/toolbox/{path} [get]
func NewEchoProxyRequestHandler(getProxyTarget func(echo.Context) (*url.URL, string, map[string]string, error)) echo.HandlerFunc {
	return func(c echo.Context) error {
		target, targetHost, extraHeaders, err := getProxyTarget(c)
		if err != nil {
			return err
		}

		fullTargetURL := target.String()

		outReq, err := http.NewRequestWithContext(
			c.Request().Context(),
			c.Request().Method,
			fullTargetURL,
			c.Request().Body,
		)
		if err != nil {
			return common_errors.NewBadRequestError(fmt.Errorf("failed to create outgoing request: %w", err))
		}

		// Copy headers from original request
		for key, values := range c.Request().Header {
			if key != "Connection" {
				for _, value := range values {
					outReq.Header.Add(key, value)
				}
			}
		}

		outReq.Host = targetHost
		outReq.Header.Set("Connection", "keep-alive")

		// Add extra headers from getProxyTarget
		for key, value := range extraHeaders {
			outReq.Header.Set(key, value)
		}

		// Handle WebSocket upgrade
		if c.Request().Header.Get("Upgrade") == "websocket" {
			ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
			}
			defer ws.Close()

			// Prepare headers for WebSocket connection
			reqExtraHeaders := http.Header{}
			for key, value := range extraHeaders {
				reqExtraHeaders.Set(key, value)
			}

			// Convert HTTP URL to WebSocket URL
			wsURL := strings.Replace(fullTargetURL, "http://", "ws://", 1)
			wsURL = strings.Replace(wsURL, "https://", "wss://", 1)

			conn, _, err := websocket.DefaultDialer.DialContext(c.Request().Context(), wsURL, reqExtraHeaders)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
			}
			defer conn.Close()

			// Proxy WebSocket messages bidirectionally
			go func() {
				defer conn.Close()
				defer ws.Close()
				io.Copy(ws.NetConn(), conn.NetConn())
			}()

			defer conn.Close()
			defer ws.Close()
			io.Copy(conn.NetConn(), ws.NetConn())
			return nil
		}

		// Make the HTTP request
		resp, err := proxyClient.Do(outReq)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadGateway, fmt.Sprintf("proxy request failed: %v", err))
		}
		defer resp.Body.Close()

		// Copy response headers
		for key, values := range resp.Header {
			for _, value := range values {
				c.Response().Header().Add(key, value)
			}
		}

		// Set status code
		c.Response().WriteHeader(resp.StatusCode)

		// Copy response body
		if _, err := io.Copy(c.Response(), resp.Body); err != nil {
			log.Errorf("Error copying response body: %v", err)
		}

		return nil
	}
}
