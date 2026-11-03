// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"crypto/ed25519"
	"errors"
	"fmt"
	"testing"

	"github.com/snapflowio/snapflow/internal/state"
)

func TestDevelopmentSigningKeyKeepsALoadedKey(t *testing.T) {
	_, signingKey, err := state.GenerateSigningKey()
	if err != nil {
		t.Fatal(err)
	}
	selected, err := developmentSigningKey(&state.Identity{SigningKey: signingKey}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !selected.Equal(signingKey) {
		t.Fatal("a readable identity must keep its signing key")
	}
}

func TestDevelopmentSigningKeyReplacesAMissingOrUnreadableKey(t *testing.T) {
	for _, loadErr := range []error{
		state.ErrNotRegistered,
		fmt.Errorf("%w: credential host key changed", state.ErrIdentityKeyUnavailable),
	} {
		selected, err := developmentSigningKey(nil, loadErr)
		if err != nil {
			t.Fatalf("%v: %v", loadErr, err)
		}
		if len(selected) != ed25519.PrivateKeySize {
			t.Fatalf("%v: generated key has %d bytes", loadErr, len(selected))
		}
	}
}

func TestDevelopmentSigningKeyStopsOnOtherErrors(t *testing.T) {
	loadErr := errors.New("state database is corrupt")
	if _, err := developmentSigningKey(nil, loadErr); !errors.Is(err, loadErr) {
		t.Fatalf("error = %v, want %v", err, loadErr)
	}
}

func TestSameRegistrationNeedsAStoredIdentity(t *testing.T) {
	enrolled := &state.Identity{APIURL: "http://127.0.0.1:3001/api", MachineID: "machine", OwnerID: "owner", KeyID: "key"}
	if sameRegistration(nil, enrolled) {
		t.Fatal("a missing identity must be saved")
	}
	moved := *enrolled
	moved.MachineID = "recreated"
	if sameRegistration(&moved, enrolled) {
		t.Fatal("a machine recreated after a database reset must be saved")
	}
	if !sameRegistration(enrolled, enrolled) {
		t.Fatal("an unchanged registration must not be saved again")
	}
}
