// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package runtime

import (
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
)

func TestSupervisionEligibleHonorsRuntimeAndManualStopState(t *testing.T) {
	policy := &restartpolicy.Policy{Mode: restartpolicy.ModeOnFailure}
	tests := []struct {
		name     string
		metadata state.InstanceMetadata
		want     bool
	}{
		{name: "running instance", metadata: state.InstanceMetadata{State: types.RuntimeStateStarted}, want: true},
		{name: "stopped with policy", metadata: state.InstanceMetadata{State: types.RuntimeStateStopped, RestartPolicy: policy}, want: true},
		{name: "stopped manually", metadata: state.InstanceMetadata{State: types.RuntimeStateStopped, RestartPolicy: policy, RestartStatus: restartpolicy.ManualStopStatus()}},
		{name: "stopped without policy", metadata: state.InstanceMetadata{State: types.RuntimeStateStopped}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := supervisionEligible(test.metadata); got != test.want {
				t.Fatalf("supervisionEligible() = %t, want %t", got, test.want)
			}
		})
	}
}

func TestRestartStatusStabilityUsesMostRecentStartOrAttempt(t *testing.T) {
	now := time.Now().UTC()
	startedAt := now.Add(-20 * time.Minute)
	lastAttempt := now.Add(-5 * time.Minute)
	metadata := state.InstanceMetadata{
		StartedAt:     &startedAt,
		RestartPolicy: &restartpolicy.Policy{Mode: restartpolicy.ModeOnFailure, StableAfter: "10m"},
		RestartStatus: restartpolicy.Status{Attempts: 1, LastAttemptAt: &lastAttempt},
	}
	if restartStatusIsStable(metadata, now) {
		t.Fatal("restart status became stable before the last attempt's stable window elapsed")
	}
	if !restartStatusIsStable(metadata, now.Add(6*time.Minute)) {
		t.Fatal("restart status did not become stable after the last attempt's stable window")
	}
}
