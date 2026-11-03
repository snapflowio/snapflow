// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"crypto/ed25519"
	"encoding/base64"
	"strings"
	"testing"
)

type recordingSigner struct {
	key ed25519.PrivateKey
}

func (signer recordingSigner) EdgeID() string { return testEdgeID }

func (signer recordingSigner) Sign(payload []byte) (string, error) {
	return base64.RawURLEncoding.EncodeToString(ed25519.Sign(signer.key, payload)), nil
}

func newRecordingSigner() recordingSigner {
	return recordingSigner{key: ed25519.NewKeyFromSeed(make([]byte, ed25519.SeedSize))}
}

func TestSignChainsToThePreviousDigestAndSignsTheDomain(t *testing.T) {
	t.Parallel()
	signer := newRecordingSigner()
	interval := testInterval(testIntervalStart())
	first, err := signCheckpoint(signer, queueCursor{Epoch: 1}, interval)
	if err != nil {
		t.Fatalf("sign first checkpoint: %v", err)
	}
	if first.Sequence != "1" || first.PreviousDigest != nil || !isSHA256Digest(first.Digest) {
		t.Fatalf("first checkpoint = %+v", first)
	}
	second, err := signCheckpoint(signer, queueCursor{Epoch: 1, Sequence: 1, Digest: first.Digest, Position: 1}, interval)
	if err != nil {
		t.Fatalf("sign second checkpoint: %v", err)
	}
	if second.Sequence != "2" || second.PreviousDigest == nil || *second.PreviousDigest != first.Digest ||
		second.Digest == first.Digest {
		t.Fatalf("second checkpoint = %+v, want it chained to the first", second)
	}
	signature, err := base64.RawURLEncoding.DecodeString(second.Signature)
	if err != nil {
		t.Fatalf("decode signature: %v", err)
	}
	message := strings.Join([]string{
		"snapflow.edge-usage.v2", testEdgeID, "1", second.Sequence, second.Digest,
	}, signatureSeparator)
	publicKey, valid := signer.key.Public().(ed25519.PublicKey)
	if !valid || !ed25519.Verify(publicKey, []byte(message), signature) {
		t.Fatal("checkpoint signature does not cover the usage domain, Edge, epoch, sequence, and digest")
	}
}

func TestSignRejectsInvalidIntervals(t *testing.T) {
	t.Parallel()
	interval := testInterval(testIntervalStart())
	interval.Samples[0].BytesIn = "01"
	if _, err := signCheckpoint(newRecordingSigner(), queueCursor{Epoch: 1}, interval); err == nil {
		t.Fatal("a non-canonical usage counter was signed")
	}
}

func TestSignRequiresAnOpenEpoch(t *testing.T) {
	t.Parallel()
	if _, err := signCheckpoint(newRecordingSigner(), queueCursor{}, testInterval(testIntervalStart())); err == nil {
		t.Fatal("a checkpoint was signed outside a usage epoch")
	}
}

func TestParseSequenceAcceptsOnlyCanonicalPositiveIntegers(t *testing.T) {
	t.Parallel()
	for _, value := range []string{"", "0", "01", "-1", "9223372036854775808", "x"} {
		if _, err := parseSequence(value); err == nil {
			t.Fatalf("sequence %q was accepted", value)
		}
	}
	if sequence, err := parseSequence("42"); err != nil || sequence != 42 {
		t.Fatalf("sequence 42 = %d (%v)", sequence, err)
	}
}
