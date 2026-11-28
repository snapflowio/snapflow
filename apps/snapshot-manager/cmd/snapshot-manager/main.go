// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/common-go/pkg/logging"
	"github.com/snapflowio/snapshot-manager/internal/manager"
	"github.com/snapflowio/snapshot-manager/internal/registry"
)

var version = "v0.0.0-dev"

const (
	commandName            = "snapshot-manager"
	exitSuccess            = 0
	exitRuntimeError       = 1
	exitConfigurationError = 2
)

func main() {
	os.Exit(run())
}

func run() int {
	bootstrapLogger := logging.SetDefault(logging.Options{Writer: os.Stdout})

	profile, err := deployment.ParseArguments(deployment.NewFlagSet(commandName), os.Args[1:])
	if err != nil {
		bootstrapLogger.Error("Invalid arguments", "error", err)
		return exitConfigurationError
	}

	config, err := manager.LoadConfig(profile)
	if err != nil {
		bootstrapLogger.Error("Failed to load configuration", "error", err)
		return exitConfigurationError
	}

	logger := logging.SetDefault(logging.Options{Writer: os.Stdout, Level: config.LogLevel})
	registry.BridgeLogs(logger)
	server, err := manager.New(config, manager.WithLogger(logger), manager.WithVersion(version))
	if err != nil {
		logger.Error("Failed to create server instance", "error", err)
		return exitRuntimeError
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	context.AfterFunc(ctx, stop)
	if err := server.Run(ctx); err != nil {
		logger.Error("Registry error", "error", err)
		return exitRuntimeError
	}

	logger.Info("Snapflow Snapshot manager stopped")
	return exitSuccess
}
