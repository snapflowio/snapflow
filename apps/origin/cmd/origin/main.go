// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/snapflowio/common-go/pkg/logging"
	"github.com/snapflowio/origin/internal/certificate"
	"github.com/snapflowio/origin/internal/config"
	"github.com/snapflowio/origin/internal/connector"
	"github.com/snapflowio/origin/internal/health"
	"github.com/snapflowio/origin/internal/openbao"
)

var version = "development"

const (
	exitSuccess            = 0
	exitRuntimeError       = 1
	exitConfigurationError = 2
)

type component interface {
	Run(ctx context.Context) error
}

func main() {
	os.Exit(run())
}

func run() int {
	bootstrapLogger := logging.SetDefault(logging.Options{})
	settings, err := config.Load()
	if err != nil {
		bootstrapLogger.Error("load origin connector configuration", "error", err)
		return exitConfigurationError
	}
	logger := logging.SetDefault(logging.Options{Level: settings.LogLevel})
	components, err := build(settings, logger)
	if err != nil {
		logger.Error("create origin connector", "error", err)
		return exitConfigurationError
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	logger.Info("starting Snapflow origin connector", "site", settings.Site, "edges", len(settings.Edges), "version", version)
	if err := runComponents(ctx, components); err != nil {
		logger.Error("origin connector stopped", "error", err)
		return exitRuntimeError
	}
	return exitSuccess
}

func build(settings config.Config, logger *slog.Logger) ([]component, error) {
	certificates, err := certificate.New(settings.Site, openbao.New(settings), logger)
	if err != nil {
		return nil, err
	}
	tunnels, err := connector.New(settings, certificates, logger)
	if err != nil {
		return nil, err
	}
	checks, err := health.New(settings.HealthAddress, tunnels)
	if err != nil {
		return nil, err
	}
	return []component{certificates, tunnels, checks}, nil
}

func runComponents(parent context.Context, components []component) error {
	ctx, cancel := context.WithCancel(parent)
	defer cancel()
	results := make(chan error, len(components))
	for _, running := range components {
		go func() { results <- running.Run(ctx) }()
	}
	failures := <-results
	cancel()
	if failures == nil {
		failures = errComponentStopped
	}
	for range len(components) - 1 {
		failures = errors.Join(failures, <-results)
	}
	if parent.Err() != nil {
		return nil
	}
	return failures
}

var errComponentStopped = errors.New("a component stopped unexpectedly")
