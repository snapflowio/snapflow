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
	}, nil
}

func (server *Server) Run(ctx context.Context) error {
	server.mu.Lock()
	if server.started {
		server.mu.Unlock()
		return ErrAlreadyStarted
	}
	server.started = true
	server.mu.Unlock()
	return supervise(ctx, server.components)
}
