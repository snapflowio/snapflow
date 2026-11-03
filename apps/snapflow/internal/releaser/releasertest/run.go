// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package releasertest

import (
	"bytes"
	"strings"
	"testing"

	"github.com/snapflowio/snapflow/internal/releaser"
)

const Version = "releasertest"

type Result struct {
	Output   string
	Err      error
	ExitCode int
}

func Run(t *testing.T, arguments ...string) Result {
	t.Helper()
	var output bytes.Buffer
	tool := releaser.New(
		releaser.Config{In: strings.NewReader(""), Out: &output, Err: &output},
		releaser.WithVersion(Version),
	)
	err := tool.Run(t.Context(), arguments)
	return Result{Output: output.String(), Err: err, ExitCode: releaser.ExitCode(err)}
}
