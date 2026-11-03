// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"context"
	"errors"
	"log/slog"
	"sync"

	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/control"
)

var (
	ErrAlreadyStarted = errors.New("the Snapflow daemon was already started")
	ErrStopped        = errors.New("the Snapflow service stopped without a shutdown request")
)

type Daemon struct {
	cfg     *config.Config
	options options
	logger  *slog.Logger
	closers closers
	client  *control.Client
	mu      sync.Mutex
	started bool
	cancel  context.CancelFunc
	done    chan struct{}
}

func New(cfg *config.Config, opts ...Option) (*Daemon, error) {
	if cfg == nil {
		return nil, errors.New("the Snapflow configuration is required")
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	configured := newOptions(opts)
	return &Daemon{cfg: cfg, options: configured, logger: configured.logger, done: make(chan struct{})}, nil
}

func (daemon *Daemon) Run(ctx context.Context) error {
	runContext, cancel := context.WithCancel(ctx)
	defer cancel()
	daemon.mu.Lock()
	if daemon.started {
		daemon.mu.Unlock()
		return ErrAlreadyStarted
	}
	daemon.started = true
	daemon.cancel = cancel
	daemon.mu.Unlock()
	defer close(daemon.done)
	defer daemon.closers.closeAll(daemon.logger)
	return daemon.run(runContext)
}

func (daemon *Daemon) Shutdown(ctx context.Context) error {
	daemon.mu.Lock()
	started, cancel := daemon.started, daemon.cancel
	daemon.mu.Unlock()
	if !started {
		return nil
	}
	cancel()
	select {
	case <-daemon.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
