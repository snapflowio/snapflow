// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package identity

import (
	"crypto/ed25519"
	"encoding/base64"
	"strings"
	"testing"
	"time"
)

const testEdgeID = "00000000-0000-4000-8000-000000000001"

func TestIdentityIsStableAcrossRestarts(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	first, err := LoadOrCreate(directory, testEdgeID)
	if err != nil {
		t.Fatalf("create identity: %v", err)
	}
	second, err := LoadOrCreate(directory, testEdgeID)
	if err != nil {
		t.Fatalf("reload identity: %v", err)
	}
	if first.KeyID() != second.KeyID() || !strings.HasPrefix(first.KeyID(), keyIDPrefix) {
		t.Fatalf("key IDs = %q and %q, want one stable %s key", first.KeyID(), second.KeyID(), keyIDPrefix)
	}
}

func TestProofsAreDomainSeparatedAndVerifiable(t *testing.T) {
	t.Parallel()
	identity, err := LoadOrCreate(t.TempDir(), testEdgeID)
	if err != nil {
		t.Fatalf("create identity: %v", err)
	}
	now := time.Now()
	session, err := identity.SessionProof(now)
	if err != nil {
		t.Fatalf("create session proof: %v", err)
	}
	signature, err := base64.RawURLEncoding.DecodeString(session.Signature)
	if err != nil {
		t.Fatalf("decode session proof: %v", err)
	}
	payload := strings.Join([]string{
		sessionProofDomain,
		testEdgeID,
		identity.KeyID(),
		session.IssuedAt.Format(time.RFC3339Nano),
		session.Nonce,
	}, proofFieldSeparator)
	if !ed25519.Verify(identity.publicKey, []byte(payload), signature) {
		t.Fatal("session proof does not verify against the identity key")
	}
	enrollment, err := identity.EnrollmentProof(now)
	if err != nil {
		t.Fatalf("create enrollment proof: %v", err)
	}
	if enrollment.Signature == session.Signature {
		t.Fatal("enrollment and session proofs are not domain separated")
	}
}
