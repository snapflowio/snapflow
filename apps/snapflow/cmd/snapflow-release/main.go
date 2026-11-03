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

	"github.com/snapflowio/snapflow/internal/releaser"
)

var version = "v0.0.0-dev"

func main() {
	tool := releaser.New(
		releaser.Config{In: os.Stdin, Out: os.Stdout, Err: os.Stderr},
		releaser.WithVersion(version),
	)
	os.Exit(releaser.ExitCode(tool.Run(context.Background(), os.Args[1:])))
}
