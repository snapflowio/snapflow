// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//	@title			Snapflow local API
//	@version		v0.0.0-dev
//	@description	Snapflow local API
//	@license.name	Apache-2.0
//	@license.url	https://www.apache.org/licenses/LICENSE-2.0

//	@securityDefinitions.apikey	Bearer
//	@in							header
//	@name						Authorization
//	@description				Type "Bearer" followed by a space and a session-scoped connection token.

//	@Security	Bearer

package localapi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	echootel "github.com/labstack/echo-opentelemetry"
	"github.com/labstack/echo/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/common-go/pkg/httpserver"
	"github.com/snapflowio/snapflow/internal/localapi/contract"
	"github.com/snapflowio/snapflow/internal/localapi/docs"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

const (
	apiBasePath          = "/"
	telemetryService     = "snapflowd"
	listenNetwork        = "tcp"
	shutdownTimeout      = 5 * time.Second
	documentationRoute   = "/api/*"
	documentRoute        = "/api/doc.json"
	metricsRoute         = "/metrics"
	machineInfoRoute     = "/info"
	protectedGroupPrefix = ""
	serverComponentName  = "server"
)

type Config struct {
	Port        int
	Development bool
	Version     string
}

type Dependencies struct {
	ConnectionToken string
	Metrics         metricsCollector
	Registry        prometheus.Gatherer
	Runtime         runtimeHealth
}

type Server struct {
	logger          *slog.Logger
	cfg             Config
	connectionToken string
	registry        prometheus.Gatherer
	controllers     *controllers
	httpServer      *http.Server
	mu              sync.Mutex
	listener        net.Listener
}

func New(cfg Config, deps Dependencies, opts ...Option) (*Server, error) {
	if deps.ConnectionToken == "" || deps.Metrics == nil || deps.Runtime == nil || cfg.Version == "" {
		return nil, errors.New("the Snapflow API connection token, metrics, runtime, and version are required")
	}
	return &Server{
		logger:          newOptions(opts).logger.With(slog.String("component", serverComponentName)),
		cfg:             cfg,
		connectionToken: deps.ConnectionToken,
		registry:        deps.Registry,
		controllers:     &controllers{metrics: deps.Metrics, runtime: deps.Runtime, version: cfg.Version},
	}, nil
}

func (server *Server) Prepare(ctx context.Context) error {
	server.mu.Lock()
	defer server.mu.Unlock()
	if server.httpServer != nil {
		return errors.New("the Snapflow API server is already prepared")
	}
	httpServer := &http.Server{
		Addr:    net.JoinHostPort(contract.Host, fmt.Sprint(server.cfg.Port)),
		Handler: server.router(),
	}
	httpserver.ApplyTimeouts(httpServer)
	listener, err := (&net.ListenConfig{}).Listen(ctx, listenNetwork, httpServer.Addr)
	if err != nil {
		return fmt.Errorf("listen on Snapflow API address %s: %w", httpServer.Addr, err)
	}
	server.httpServer = httpServer
	server.listener = listener
	return nil
}

func (server *Server) router() *echo.Echo {
	router := echo.NewWithConfig(echo.Config{
		Logger:           server.logger,
		HTTPErrorHandler: common_errors.NewHTTPErrorHandler(handleRuntimeError),
	})
	router.Use(common_errors.Recovery())
	router.Use(echootel.NewMiddleware(telemetryService))
	router.Use(recoverableErrorsMiddleware())

	router.GET(contract.HealthRoute, server.controllers.healthCheck)
	if server.cfg.Development {
		server.documentation(router)
	}

	protected := router.Group(protectedGroupPrefix, authMiddleware(server.connectionToken))
	protected.GET(metricsRoute, echo.WrapHandler(promhttp.HandlerFor(server.registry, promhttp.HandlerOpts{})))
	protected.GET(machineInfoRoute, server.controllers.machineInfo)
	return router
}

func (server *Server) Run(ctx context.Context) error {
	server.mu.Lock()
	httpServer, listener := server.httpServer, server.listener
	server.listener = nil
	server.mu.Unlock()
	if httpServer == nil || listener == nil {
		return errors.New("the Snapflow API server is not prepared")
	}
	httpServer.BaseContext = func(net.Listener) context.Context { return ctx }
	served := make(chan error, 1)
	go func() { served <- server.serve(httpServer, listener) }()
	select {
	case err := <-served:
		return err
	case <-ctx.Done():
	}
	shutdownContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	return errors.Join(httpServer.Shutdown(shutdownContext), <-served)
}

func (server *Server) serve(httpServer *http.Server, listener net.Listener) error {
	if err := httpServer.Serve(listener); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func (server *Server) Close() error {
	server.mu.Lock()
	listener := server.listener
	server.listener = nil
	server.mu.Unlock()
	if listener == nil {
		return nil
	}
	if err := listener.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
		return fmt.Errorf("close Snapflow API listener: %w", err)
	}
	return nil
}

func (server *Server) documentation(router *echo.Echo) {
	spec := *docs.SwaggerInfo
	spec.BasePath = apiBasePath
	spec.Version = server.cfg.Version
	document := []byte(spec.ReadDoc())
	router.GET(documentRoute, func(ctx *echo.Context) error {
		return ctx.Blob(http.StatusOK, echo.MIMEApplicationJSON, document)
	})
	router.GET(documentationRoute, echo.WrapHandler(httpSwagger.Handler(httpSwagger.URL(documentRoute))))
}
