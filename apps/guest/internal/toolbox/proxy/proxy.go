// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/common-go/pkg/httpproxy"
)

const (
	PortParameter  = "port"
	targetHost     = "localhost"
	targetScheme   = "http"
	portBits       = 16
	flushInterval  = 100 * time.Millisecond
	pathSeparator  = "/"
	wildcardSuffix = "*"
)

type Handler struct {
	logger    *slog.Logger
	transport http.RoundTripper
	buffers   httputil.BufferPool
}

func New(logger *slog.Logger) *Handler {
	return &Handler{
		logger:    logger.With(slog.String("component", "proxy")),
		transport: newTransport(),
		buffers:   httpproxy.NewResponseBufferPool(),
	}
}

func (h *Handler) Serve(ctx *echo.Context) error {
	target, err := targetURL(ctx)
	if err != nil {
		return err
	}
	reverseProxy := &httputil.ReverseProxy{
		Rewrite:       func(request *httputil.ProxyRequest) { rewrite(request, target) },
		Transport:     h.transport,
		BufferPool:    h.buffers,
		FlushInterval: flushInterval,
		ErrorHandler:  h.errorHandler(ctx),
	}
	reverseProxy.ServeHTTP(ctx.Response(), ctx.Request())
	return nil
}

func targetURL(ctx *echo.Context) (*url.URL, error) {
	port := ctx.Param(PortParameter)
	parsed, err := strconv.ParseUint(port, 10, portBits)
	if err != nil || parsed == 0 {
		return nil, common_errors.NewBadRequestError(fmt.Errorf("target port %q must be a number between 1 and 65535", port))
	}
	address := net.JoinHostPort(targetHost, strconv.FormatUint(parsed, 10))
	target, err := url.Parse(targetScheme + "://" + address + targetPath(ctx, port))
	if err != nil {
		return nil, common_errors.NewBadRequestError(fmt.Errorf("parse target URL: %w", err))
	}
	return target, nil
}

func targetPath(ctx *echo.Context, port string) string {
	escaped := ctx.Request().URL.EscapedPath()
	prefix := strings.Replace(strings.TrimSuffix(ctx.Path(), wildcardSuffix), ":"+PortParameter, port, 1)
	if strings.HasPrefix(escaped, prefix) {
		return pathSeparator + escaped[len(prefix):]
	}
	return pathSeparator + strings.TrimPrefix(ctx.Param(wildcardSuffix), pathSeparator)
}

func rewrite(request *httputil.ProxyRequest, target *url.URL) {
	outbound := request.Out
	outbound.Host = target.Host
	outbound.URL.Scheme = target.Scheme
	outbound.URL.Host = target.Host
	outbound.URL.Path = target.Path
	outbound.URL.RawPath = target.RawPath
	outbound.Header.Del(guestspec.AuthHeader)
	request.SetXForwarded()
}

func (h *Handler) errorHandler(ctx *echo.Context) func(http.ResponseWriter, *http.Request, error) {
	return func(writer http.ResponseWriter, request *http.Request, err error) {
		if errors.Is(err, context.Canceled) {
			return
		}
		h.logger.Warn("Proxy request failed", "method", request.Method, "path", request.URL.Path, "error", err)
		response, unwrapErr := echo.UnwrapResponse(ctx.Response())
		if unwrapErr == nil && response.Committed {
			return
		}
		writer.WriteHeader(http.StatusBadGateway)
	}
}
