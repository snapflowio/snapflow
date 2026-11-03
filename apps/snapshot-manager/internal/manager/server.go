// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package manager

import (
	"context"
	"sync"
)

type Server struct {
	components componentSet
	mu         sync.Mutex
	started    bool
	cancel     context.CancelFunc
	done       chan struct{}
}

func New(config Config, opts ...Option) (*Server, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}
	components, err := assemble(config, newOptions(opts))
	if err != nil {
		return nil, err
	}
	return &Server{
		components: components,
		done:       make(chan struct{}),
	}, nil
}

func (server *Server) Run(ctx context.Context) error {
	runContext, cancel := context.WithCancel(ctx)
	defer cancel()
	server.mu.Lock()
	if server.started {
		server.mu.Unlock()
		return ErrAlreadyStarted
	}
	server.started = true
	server.cancel = cancel
	server.mu.Unlock()
	defer close(server.done)
	return supervise(runContext, server.components)
}

func (server *Server) Shutdown(ctx context.Context) error {
	server.mu.Lock()
	started, cancel := server.started, server.cancel
	server.mu.Unlock()
	if !started {
		return nil
	}
	cancel()
	select {
	case <-server.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
