// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"crypto/ed25519"
	"encoding/base64"
	"testing"
	"time"
)

const (
	vectorName      = "garage-4090"
	vectorIssuedAt  = "2026-10-13T12:00:00.123Z"
	vectorNonce     = "oKGio6SlpqeoqaqrrK2urw"
	vectorKeyID     = "ed25519:a050837d85070582ccf7394b0988847cc312cb88259b894899f6f239cf1791a5"
	vectorSignature = "UCobvHLKA3-36MuEg4cJ_HiFN9Zzm4wjaHO4qYfvTMjdTPOkSfEKIV1Jp_C6LUdGA-TXw99fOEI6E9YL9J5QCw"
	vectorMessage   = "snapflow.machine-registration\n" + vectorName + "\n" +
		vectorKeyID + "\n" + vectorIssuedAt + "\n" + vectorNonce
	minimumNonceBytes = 16
)

func vectorKey() ed25519.PrivateKey {
	seed := make([]byte, ed25519.SeedSize)
	for index := range seed {
		seed[index] = byte(index)
	}
	return ed25519.NewKeyFromSeed(seed)
}

func TestRegistrationProofMatchesAPIVector(t *testing.T) {
	issuedAt, err := time.Parse(time.RFC3339Nano, vectorIssuedAt)
	if err != nil {
		t.Fatal(err)
	}
	key := vectorKey()
	keyID, err := KeyID(vectorPublicKey(t))
	if err != nil || keyID != vectorKeyID {
		t.Fatalf("key ID = %q, %v; want %q", keyID, err, vectorKeyID)
	}
	if message := string(registrationProofMessage(vectorName, keyID, issuedAt, vectorNonce)); message != vectorMessage {
		t.Fatalf("canonical message = %q, want %q", message, vectorMessage)
	}
	proof, err := signRegistration(vectorName, key, issuedAt, vectorNonce)
	if err != nil {
		t.Fatal(err)
	}
	if proof.Signature != vectorSignature {
		t.Fatalf("signature = %q, want %q", proof.Signature, vectorSignature)
	}
}

func TestSignRegistrationProducesVerifiableProof(t *testing.T) {
	key := vectorKey()
	now := time.Date(2026, time.October, 13, 12, 0, 0, 123456789, time.FixedZone("CEST", 2*60*60))
	proof, err := SignRegistration(vectorName, key, now)
	if err != nil {
		t.Fatal(err)
	}
	if got := proof.IssuedAt.Format(time.RFC3339Nano); got != "2026-10-13T10:00:00.123Z" {
		t.Fatalf("issuedAt = %q, want UTC with millisecond precision", got)
	}
	nonce, err := base64.RawURLEncoding.DecodeString(proof.Nonce)
	if err != nil || len(nonce) < minimumNonceBytes {
		t.Fatalf("nonce %q is not unpadded base64url of at least %d bytes", proof.Nonce, minimumNonceBytes)
	}
	signature, err := base64.RawURLEncoding.DecodeString(proof.Signature)
	if err != nil {
		t.Fatal(err)
	}
	message := registrationProofMessage(vectorName, vectorKeyID, proof.IssuedAt, proof.Nonce)
	if !ed25519.Verify(vectorPublicKey(t), message, signature) {
		t.Fatal("registration signature does not verify")
	}
}

func TestSignRegistrationRequiresName(t *testing.T) {
	if _, err := SignRegistration(" ", vectorKey(), time.Now()); err == nil {
		t.Fatal("registration proof without a name was signed")
	}
}

func vectorPublicKey(t *testing.T) ed25519.PublicKey {
	t.Helper()
	publicKey, ok := vectorKey().Public().(ed25519.PublicKey)
	if !ok {
		t.Fatal("the vector key has no Ed25519 public key")
	}
	return publicKey
}
