// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package consoletest

import (
	"bytes"
	"strings"
	"testing"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/console"
)

const Version = "consoletest"

type Result struct {
	Output   string
	Err      error
	ExitCode int
}

func Run(t *testing.T, arguments ...string) Result {
	t.Helper()
	var output bytes.Buffer
	application := console.New(
		console.Config{In: strings.NewReader(""), Out: &output, Err: &output},
		console.WithVersion(Version),
	)
	err := application.Run(t.Context(), arguments)
	return Result{Output: output.String(), Err: err, ExitCode: cli.ExitCode(err)}
}
