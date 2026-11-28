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
	"github.com/snapflowio/edge/internal/edge"
)

var version = "development"

const (
	commandName            = "edge"
	exitSuccess            = 0
	exitRuntimeError       = 1
	exitConfigurationError = 2
	checkHealthFlag        = "check-health"
	checkHealthUsage       = "check the readiness of the edge running on this host and exit"
)

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(arguments []string) int {
	bootstrapLogger := logging.SetDefault(logging.Options{})
	flags := deployment.NewFlagSet(commandName)
	checkHealth := flags.Bool(checkHealthFlag, false, checkHealthUsage)
	profile, err := deployment.ParseArguments(flags, arguments)
	if err != nil {
		bootstrapLogger.Error("invalid edge arguments", "error", err)
		return exitConfigurationError
	}
	if *checkHealth {
		if err := edge.CheckHealth(context.Background()); err != nil {
			bootstrapLogger.Error("edge health check failed", "error", err)
			return exitRuntimeError
		}
		return exitSuccess
	}
	config, err := edge.LoadConfig(profile)
	if err != nil {
		bootstrapLogger.Error("load edge configuration", "error", err)
		return exitConfigurationError
	}
	logger := logging.SetDefault(logging.Options{Level: config.LogLevel})
	server, err := edge.New(config, edge.WithLogger(logger), edge.WithVersion(version))
	if err != nil {
		logger.Error("create edge server", "error", err)
		return exitRuntimeError
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := server.Run(ctx); err != nil {
		logger.Error("edge stopped", "error", err)
		return exitRuntimeError
	}
	return exitSuccess
}
