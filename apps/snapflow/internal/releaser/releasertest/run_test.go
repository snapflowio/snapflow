// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package releasertest

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/snapflowio/snapflow/internal/cli"
)

const (
	versionFlag        = "--version"
	tufCommand         = "tuf"
	checkExpiryCommand = "check-expiry"
	repositoryFlag     = "--repository"
	withinFlag         = "--within"
	expiryWindow       = "720h"
	missingRepository  = "missing-repository"
)

func TestRunReportsTheInjectedVersion(t *testing.T) {
	result := Run(t, versionFlag)
	if result.ExitCode != cli.ExitSuccess || !strings.Contains(result.Output, Version) {
		t.Fatalf("snapflow-release %s = exit %d, output %q", versionFlag, result.ExitCode, result.Output)
	}
}

func TestRunFailsWhenTheRepositoryIsMissing(t *testing.T) {
	missing := filepath.Join(t.TempDir(), missingRepository)
	result := Run(t, tufCommand, checkExpiryCommand, repositoryFlag, missing, withinFlag, expiryWindow)
	if result.ExitCode != cli.ExitRuntimeError || result.Err == nil || !strings.Contains(result.Output, result.Err.Error()) {
		t.Fatalf("snapflow-release tuf check-expiry = exit %d, error %v, output %q", result.ExitCode, result.Err, result.Output)
	}
	if strings.Contains(result.Output, "unknown command") {
		t.Fatalf("snapflow-release tuf check-expiry is not registered: %q", result.Output)
	}
}
