// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package plan

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
)

func TestBindingTargetChangesReuseTransport(t *testing.T) {
	identity := protocol.Binding{
		ID:       uuid.New(),
		Revision: 4,
		Digest:   "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	}
	current := Binding{
		EdgeID: uuid.New(), Address: "edge.example:443", ServerName: "edge.example",
		Identity: identity, TargetRevision: 7,
	}
	replacement := current
	replacement.TargetRevision++
	replacement.Targets = map[uuid.UUID]Target{
		uuid.New(): {BackendID: uuid.New()},
	}

	if !current.SameConnection(replacement) {
		t.Fatal("a target-only update must not replace the established Edge transport")
	}
}

func TestBindingTargetDigestIsCanonicalAndFenced(t *testing.T) {
	firstID := uuid.MustParse("11111111-1111-4111-8111-111111111111")
	secondID := uuid.MustParse("22222222-2222-4222-8222-222222222222")
	first := targetForDigest(firstID)
	second := targetForDigest(secondID)
	binding := Binding{
		Identity:       protocol.Binding{ID: uuid.New(), Revision: 2},
		TargetRevision: 9,
		Targets:        map[uuid.UUID]Target{firstID: first, secondID: second},
	}
	forward, err := bindingTargetDigest(binding)
	if err != nil {
		t.Fatalf("digest forward target plan: %v", err)
	}
	binding.Targets = map[uuid.UUID]Target{secondID: second, firstID: first}
	reversed, err := bindingTargetDigest(binding)
	if err != nil {
		t.Fatalf("digest reversed target plan: %v", err)
	}
	if forward != reversed {
		t.Fatal("target plan digest depends on map iteration order")
	}
	binding.TargetRevision++
	changed, err := bindingTargetDigest(binding)
	if err != nil {
		t.Fatalf("digest revised target plan: %v", err)
	}
	if changed == forward {
		t.Fatal("target plan revision did not fence the digest")
	}
}

func TestBindingTargetDigestMatchesControlPlaneCanonicalJSON(t *testing.T) {
	backendID := uuid.MustParse("44444444-4444-4444-8444-444444444444")
	binding := Binding{
		Identity: protocol.Binding{
			ID:       uuid.MustParse("33333333-3333-4333-8333-333333333333"),
			Revision: 7,
		},
		TargetRevision: 11,
		Targets: map[uuid.UUID]Target{
			backendID: {
				BackendID:          backendID,
				ExposureID:         uuid.MustParse("55555555-5555-4555-8555-555555555555"),
				ExposureGeneration: 1, SandboxID: "sandbox-one", AssignmentGeneration: 1,
				PlacementFencingTokenHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				Protocol:                  protocol.ProtocolHTTP, Host: "runtime", Port: 8080,
			},
		},
	}
	digest, err := bindingTargetDigest(binding)
	if err != nil {
		t.Fatalf("digest target plan: %v", err)
	}
	const expected = "3c47bc6d15aa9379ef526d03bf17b4553248a1ca2e84bdcfe3cb2b9906c16d9d"
	if digest != expected {
		t.Fatalf("target plan digest = %s, want %s", digest, expected)
	}
}

func targetForDigest(backendID uuid.UUID) Target {
	return Target{
		BackendID: backendID, ExposureID: uuid.New(), ExposureGeneration: 3,
		SandboxID: "sandbox-one", AssignmentGeneration: 5,
		PlacementFencingTokenHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		Protocol:                  protocol.ProtocolHTTP, Port: 8080, State: TargetActive,
		LeaseExpiresAt: time.Now().Add(time.Minute),
	}
}
