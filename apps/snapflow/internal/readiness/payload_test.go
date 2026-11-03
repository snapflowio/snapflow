// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package readiness

import (
	"strings"
	"testing"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const testVersion = "1.0.0"

func TestHealthcheckBoundsReason(t *testing.T) {
	healthcheck := Healthcheck(testVersion, apiclient.MachineReadinessStateFailed, strings.Repeat("r", maximumReasonLength*2))
	if healthcheck.Readiness.Reason == nil || len([]rune(*healthcheck.Readiness.Reason)) != maximumReasonLength {
		t.Fatalf("reason = %v, want %d runes", healthcheck.Readiness.Reason, maximumReasonLength)
	}
}

func TestToAPICapabilitiesRejectsUnknownHypervisor(t *testing.T) {
	if _, err := toAPICapabilities(sandboxruntime.Capabilities{Hypervisors: []string{"qemu"}}); err == nil {
		t.Fatal("toAPICapabilities accepted an unknown hypervisor")
	}
}
