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

	"github.com/snapflowio/microvm-go/internal/snapshot"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func TestMemorySnapshotPolicyRejectsManagedSecrets(t *testing.T) {
	metadata := state.InstanceMetadata{RequiresSecretEnv: true}
	if err := validateMemorySnapshotPolicy(metadata); err == nil {
		t.Fatal("expected managed secret memory snapshot to be rejected")
	}
	metadata.RequiresSecretEnv = false
	if err := validateMemorySnapshotPolicy(metadata); err != nil {
		t.Fatalf("secret-free memory snapshot was rejected: %v", err)
	}
}

func TestForkCapturesMemory(t *testing.T) {
	tests := []struct {
		name     string
		state    types.RuntimeState
		record   *snapshot.Record
		expected bool
	}{
		{name: "running source", state: types.RuntimeStateStarted, expected: true},
		{name: "stopped source", state: types.RuntimeStateStopped, expected: false},
		{name: "standby snapshot", state: types.RuntimeStateStopped, record: &snapshot.Record{Snapshot: snapshot.Snapshot{Kind: snapshot.KindStandby}}, expected: true},
		{name: "stopped snapshot", state: types.RuntimeStateStarted, record: &snapshot.Record{Snapshot: snapshot.Snapshot{Kind: snapshot.KindStopped}}, expected: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual := forkCapturesMemory(state.InstanceMetadata{State: test.state}, test.record)
			if actual != test.expected {
				t.Fatalf("forkCapturesMemory() = %t, want %t", actual, test.expected)
			}
		})
	}
}
