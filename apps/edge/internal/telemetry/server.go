// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	tcpNetwork          = "tcp"
	shutdownTimeout     = 5 * time.Second
	readHeaderTimeout   = 5 * time.Second
	metricsPath         = "/metrics"
	healthPath          = "/healthz"
	readinessPath       = "/readyz"
	readinessError      = "edge is not ready to serve assigned routes"
	cacheControlHeader  = "Cache-Control"
	noStoreCacheControl = "no-store"
	servingReadyValue   = 1
)

type Config struct {
	ListenAddress string
}

type Server struct {
	address string
	handler http.Handler
}

func NewServer(config Config, source Source) (*Server, error) {
	if source == nil || config.ListenAddress == "" {
		return nil, errors.New("metrics server requires a metrics source and a listen address")
	}
	registry := prometheus.NewRegistry()
	if err := registry.Register(newMetricsCollector(source)); err != nil {
		return nil, fmt.Errorf("register edge metrics collector: %w", err)
	}
	mux := http.NewServeMux()
	mux.Handle(
		metricsPath,
		promhttp.HandlerFor(
			registry,
			promhttp.HandlerOpts{EnableOpenMetrics: true},
		),
	)
	mux.HandleFunc(healthPath, func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set(cacheControlHeader, noStoreCacheControl)
		writer.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc(readinessPath, func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set(cacheControlHeader, noStoreCacheControl)
		if source.Snapshot().ServingReady != servingReadyValue {
			http.Error(writer, readinessError, http.StatusServiceUnavailable)
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	})
	return &Server{address: config.ListenAddress, handler: mux}, nil
}

func (server *Server) Run(ctx context.Context) error {
	var listenConfig net.ListenConfig
	listener, err := listenConfig.Listen(ctx, tcpNetwork, server.address)
	if err != nil {
		return fmt.Errorf("listen for Prometheus metrics: %w", err)
	}
	service := &http.Server{
		Handler:           server.handler,
		ReadHeaderTimeout: readHeaderTimeout,
		BaseContext: func(net.Listener) context.Context {
			return ctx
		},
	}
	result := make(chan error, 1)
	go func() {
		result <- service.Serve(listener)
	}()
	select {
	case <-ctx.Done():
		shutdownContext, cancel := context.WithTimeout(
			context.WithoutCancel(ctx),
			shutdownTimeout,
		)
		defer cancel()
		shutdownErr := service.Shutdown(shutdownContext)
		serveErr := <-result
		if errors.Is(serveErr, http.ErrServerClosed) {
			serveErr = nil
		}
		return errors.Join(serveErr, shutdownErr)
	case serveErr := <-result:
		if errors.Is(serveErr, http.ErrServerClosed) && ctx.Err() != nil {
			return nil
		}
		return serveErr
	}
}
