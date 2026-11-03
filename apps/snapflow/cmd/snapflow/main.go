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

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/console"
)

var version = "v0.0.0-dev"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	application := console.New(
		console.Config{In: os.Stdin, Out: os.Stdout, Err: os.Stderr, Environ: os.Environ()},
		console.WithVersion(version),
	)
	err := application.Run(ctx, os.Args[1:])
	stop()
	os.Exit(cli.ExitCode(err))
}
