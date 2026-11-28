// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edge

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/snapflowio/common-go/pkg/processlock"
)

const processLockFilename = "edge.lock"

var ErrAlreadyStarted = errors.New("edge server was already started")

type Server struct {
	config  Config
	options options
	mu      sync.Mutex
	started bool
}

func New(config Config, opts ...Option) (*Server, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}
	return &Server{
		config:  config,
		options: newOptions(opts),
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
	server.mu.Unlock()
	logger := server.options.logger
	logger.Info(
		"starting Snapflow edge",
		"edge_id", server.config.EdgeID,
		"profile", server.config.Profile,
		"version", server.options.version,
	)
	lock, err := processlock.Acquire(server.config.StateDir, processLockFilename)
	if err != nil {
		return fmt.Errorf("acquire edge process lock: %w", err)
	}
	defer func() {
		if closeErr := lock.Close(); closeErr != nil {
			logger.Warn("could not release edge process lock", "error", closeErr)
		}
	}()
	if err := server.ensureTLSBundle(runContext); err != nil {
		if runContext.Err() != nil {
			return nil
		}
		return err
	}
	relay, err := server.openRelay()
	if err != nil {
		return err
	}
	return server.runStages(runContext, relay)
}
