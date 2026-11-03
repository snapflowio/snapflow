// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const testSigningKeyByte = 2

type unusedRedeemer struct{}

func (unusedRedeemer) RedeemProtectedAccessGrant(
	context.Context,
	apiclient.RedeemProtectedAccessGrantDto,
) (*apiclient.ProtectedAccessGrantRedemptionDto, error) {
	return nil, errors.New("grant redemption is not part of this test")
}

func TestSessionTokensAreBackendScopedAndTamperEvident(t *testing.T) {
	t.Parallel()
	gate, err := NewGate(
		unusedRedeemer{},
		bytes.Repeat([]byte{testSigningKeyByte}, SigningKeyBytes),
		NewSessions(),
	)
	if err != nil {
		t.Fatalf("create protected access: %v", err)
	}
	backendID := uuid.New()
	wantedSessionID := uuid.New()
	now := time.Now()
	token, err := gate.signToken(backendID, wantedSessionID, now.Add(time.Hour))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	sessionless, err := gate.signToken(backendID, uuid.Nil, now.Add(time.Hour))
	if err != nil {
		t.Fatalf("sign sessionless token: %v", err)
	}
	if _, _, valid := gate.verifyToken(sessionless, backendID, now); valid {
		t.Fatal("a token without a session was accepted")
	}
	if _, sessionID, valid := gate.verifyToken(token, backendID, now); !valid || sessionID != wantedSessionID {
		t.Fatal("a freshly signed token was rejected")
	}
	if _, _, valid := gate.verifyToken(token, uuid.New(), now); valid {
		t.Fatal("a token was accepted for another backend")
	}
	if _, _, valid := gate.verifyToken(token, backendID, now.Add(2*time.Hour)); valid {
		t.Fatal("an expired token was accepted")
	}
	tampered := []byte(token)
	tampered[len(tampered)/2] ^= 1
	if _, _, valid := gate.verifyToken(string(tampered), backendID, now); valid {
		t.Fatal("a tampered token was accepted")
	}
}
