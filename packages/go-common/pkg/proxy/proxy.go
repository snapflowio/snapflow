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

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
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
//	@Tags			toolbox
//	@Summary		Proxy requests to the sandbox toolbox
//	@Description	Forwards the request to the specified sandbox's container
//	@Param			workspaceId	path		string	true	"Sandbox ID"
//	@Param			projectId	path		string	true	"Project ID"
//	@Param			path		path		string	true	"Path to forward"
//	@Success		200			{object}	string	"Proxied response"
//	@Failure		400			{object}	string	"Bad request"
//	@Failure		401			{object}	string	"Unauthorized"
//	@Failure		404			{object}	string	"Sandbox container not found"
//	@Failure		409			{object}	string	"Sandbox container conflict"
//	@Failure		500			{object}	string	"Internal server error"
//	@Router			/workspaces/{workspaceId}/{projectId}/toolbox/{path} [get]
func NewProxyRequestHandler(getProxyTarget func(*gin.Context) (*url.URL, string, map[string]string, error)) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		target, fullTargetURL, extraHeaders, err := getProxyTarget(ctx)
		if err != nil {
			return
		}

		outReq, err := http.NewRequestWithContext(
			ctx.Request.Context(),
			ctx.Request.Method,
			fullTargetURL,
			ctx.Request.Body,
		)
		if err != nil {
			ctx.Error(common_errors.NewBadRequestError(fmt.Errorf("failed to create outgoing request: %w", err)))
			return
		}

		for key, values := range ctx.Request.Header {
			// Skip the Connection header
			if key != "Connection" {
				for _, value := range values {
					outReq.Header.Add(key, value)
				}
			}
		}

		outReq.Host = target.Host
		outReq.Header.Set("Connection", "keep-alive")

		for key, value := range extraHeaders {
			outReq.Header.Add(key, value)
		}

		if ctx.Request.Header.Get("Upgrade") == "websocket" {
			ws, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
			if err != nil {
				ctx.AbortWithError(http.StatusInternalServerError, err)
				return
			}
			defer ws.Close()

			reqExtraHeaders := http.Header{}
			for key, value := range extraHeaders {
				reqExtraHeaders.Add(key, value)
			}

			conn, _, err := websocket.DefaultDialer.DialContext(ctx.Request.Context(), strings.Replace(fullTargetURL, "http", "ws", 1), reqExtraHeaders)
			if err != nil {
				ctx.AbortWithError(http.StatusInternalServerError, err)
				return
			}
			defer conn.Close()

			go func() {
				io.Copy(ws.NetConn(), conn.NetConn())
			}()

			io.Copy(conn.NetConn(), ws.NetConn())

			return
		}

		resp, err := proxyClient.Do(outReq)
		if err != nil {
			ctx.AbortWithError(http.StatusBadGateway, fmt.Errorf("proxy request failed: %w", err))
			return
		}
		defer resp.Body.Close()

		for key, values := range resp.Header {
			for _, value := range values {
				ctx.Writer.Header().Add(key, value)
			}
		}

		ctx.Writer.WriteHeader(resp.StatusCode)

		if _, err := io.Copy(ctx.Writer, resp.Body); err != nil {
			log.Errorf("Error copying response body: %v", err)
		}
	}
}
