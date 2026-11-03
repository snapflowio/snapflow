// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"testing"

	microvmgo "github.com/snapflowio/microvm-go"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
)

func TestStaleAssignmentErrorCodeMatchesEngine(t *testing.T) {
	if sandboxruntime.StaleAssignmentErrorCode != microvmgo.StaleAssignmentErrorCode {
		t.Fatalf("runtime stale assignment code %q, engine reports %q",
			sandboxruntime.StaleAssignmentErrorCode, microvmgo.StaleAssignmentErrorCode)
	}
}
