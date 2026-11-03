// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package consoletest

import (
	"strings"
	"testing"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
)

const (
	versionFlag     = "--version"
	unknownFlag     = "--bogus"
	statusCommand   = "status"
	snapflowCommand = "snapflow status"
)

func TestRunReportsTheInjectedVersion(t *testing.T) {
	result := Run(t, versionFlag)
	if result.ExitCode != cli.ExitSuccess || !strings.Contains(result.Output, Version) {
		t.Fatalf("snapflow %s = exit %d, output %q", versionFlag, result.ExitCode, result.Output)
	}
}

func TestRunReportsUsageErrorsWithAHelpHint(t *testing.T) {
	result := Run(t, statusCommand, unknownFlag)
	if result.ExitCode != cli.ExitConfigurationError || !strings.Contains(result.Output, text.HelpHint(snapflowCommand)) {
		t.Fatalf("snapflow %s %s = exit %d, output %q", statusCommand, unknownFlag, result.ExitCode, result.Output)
	}
}
