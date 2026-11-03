// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package qualification

import (
	"strings"
	"testing"
)

const testChallengeID = "challenge-1"

func TestCanaryUsesNeutralPerChallengeNames(t *testing.T) {
	first, err := newCanaryNames()
	if err != nil {
		t.Fatal(err)
	}
	second, err := newCanaryNames()
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("two challenges share canary names")
	}
	spec := canarySpec(Request{ChallengeID: testChallengeID, Canary: Canary{Snapshot: "alpine@sha256:abc", CPU: 1, MemoryGiB: 1, StorageGiB: 1}}, first)
	if len(spec.GetLabels()) != 0 {
		t.Fatalf("canary labels = %v; the canary must not be labelled", spec.GetLabels())
	}
	command := strings.Join(spec.GetImage().GetEntrypoint(), " ")
	for _, tell := range []string{"qualification", "snapflow", testChallengeID} {
		if strings.Contains(strings.ToLower(command), tell) {
			t.Fatalf("canary entrypoint %q contains %q", command, tell)
		}
	}
	if !strings.Contains(command, "$"+first.variable) || !strings.Contains(command, first.digestPath) {
		t.Fatalf("canary entrypoint %q does not use the generated names", command)
	}
}
