// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package health

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/snapflowio/common-go/pkg/httpserver"
)

const (
	LivenessPath    = "/healthz"
	ReadinessPath   = "/readyz"
	tcpNetwork      = "tcp"
	shutdownTimeout = 5 * time.Second
)

type Connections interface {
	ConnectedEdges() int32
}

type Server struct {
	address     string
	connections Connections
}

func New(address string, connections Connections) (*Server, error) {
	if address == "" || connections == nil {
		return nil, errors.New("health server requires an address and a connection source")
	}
	return &Server{address: address, connections: connections}, nil
}

func (server *Server) Run(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc(LivenessPath, func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc(ReadinessPath, func(writer http.ResponseWriter, _ *http.Request) {
		if server.connections.ConnectedEdges() == 0 {
			writer.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		writer.WriteHeader(http.StatusOK)
	})
	service := &http.Server{Handler: mux}
	httpserver.ApplyTimeouts(service)
	var listenConfig net.ListenConfig
	listener, err := listenConfig.Listen(ctx, tcpNetwork, server.address)
	if err != nil {
		return fmt.Errorf("listen for health checks: %w", err)
	}
	served := make(chan error, 1)
	go func() { served <- service.Serve(listener) }()
	select {
	case err := <-served:
		return err
	case <-ctx.Done():
	}
	shutdownContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	if err := service.Shutdown(shutdownContext); err != nil {
		return err
	}
	if err := <-served; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
