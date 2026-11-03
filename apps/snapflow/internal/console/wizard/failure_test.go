// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package wizard

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/control"
)

func TestRevokedMachinesAreToldToReplace(t *testing.T) {
	hint := hintFor(fmt.Errorf("inspect: %w", admin.ErrMachineRevoked), testProfile)
	if !strings.Contains(hint, text.CommandSetup+" --replace") {
		t.Fatalf("hint = %q, want the replace command", hint)
	}
}

func TestExpiredApprovalsAreToldToRerunSetup(t *testing.T) {
	hint := hintFor(control.ErrDeviceCodeExpired, testProfile)
	if !strings.Contains(hint, text.CommandSetup) || strings.Contains(hint, "--replace") {
		t.Fatalf("hint = %q, want a plain setup rerun", hint)
	}
}

func TestUnknownFailuresFallBackToTheGenericFix(t *testing.T) {
	hint := hintFor(errors.New("disk full"), testProfile)
	if !strings.HasPrefix(hint, text.FailedFixPrefix) {
		t.Fatalf("hint = %q, want the generic fix", hint)
	}
}
