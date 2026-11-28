// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tcp

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"sync"
	"sync/atomic"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/proxy"
	"github.com/snapflowio/edge/internal/routes"
)

const tcpNetwork = "tcp"

type portListener struct {
	frontend        *Frontend
	backendID       uuid.UUID
	port            uint16
	connectionLimit int
	socket          net.Listener
	semaphore       chan struct{}
	health          proxy.Health
	stopping        atomic.Bool
	stopOnce        sync.Once
}

func (frontend *Frontend) openListener(
	ctx context.Context,
	route routes.TCP,
) (*portListener, error) {
	address := net.JoinHostPort("", strconv.Itoa(int(route.PublicPort)))
	var listenConfig net.ListenConfig
	socket, err := listenConfig.Listen(ctx, tcpNetwork, address)
	if err != nil {
		return nil, fmt.Errorf("listen on edge TCP port %d: %w", route.PublicPort, err)
	}
	public := &portListener{
		frontend:        frontend,
		backendID:       route.BackendID,
		port:            route.PublicPort,
		connectionLimit: route.Policy.ConnectionLimit,
		socket:          socket,
		semaphore:       make(chan struct{}, route.Policy.ConnectionLimit),
	}
	go public.serve(ctx)
	public.frontend.logger.Info(
		"edge TCP route listening",
		"backend_id", route.BackendID,
		"port", route.PublicPort,
	)
	return public, nil
}

func (public *portListener) Matches(route routes.TCP) bool {
	_, failed := public.health.Failure()
	return !failed &&
		public.backendID == route.BackendID &&
		public.connectionLimit == route.Policy.ConnectionLimit
}

func (public *portListener) Failure() (string, bool) {
	return public.health.Failure()
}

func (public *portListener) Close() {
	public.stopOnce.Do(func() {
		public.stopping.Store(true)
		proxy.CloseAndLog(public.frontend.logger, "edge TCP listener", public.socket)
	})
}

func (public *portListener) serve(ctx context.Context) {
	for {
		connection, err := public.socket.Accept()
		if err != nil {
			if ctx.Err() == nil && !public.stopping.Load() {
				public.health.Fail(err.Error())
				public.frontend.logger.Warn("edge TCP listener stopped", "port", public.port, "error", err)
			}
			return
		}
		select {
		case public.semaphore <- struct{}{}:
			public.frontend.connections.Add(1)
			go public.forward(ctx, connection)
		default:
			proxy.CloseAndLog(public.frontend.logger, "capacity-rejected TCP connection", connection)
		}
	}
}
