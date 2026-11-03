// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package speedtest

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/binary"
	"encoding/pem"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	vectorKeyID       = "k1"
	vectorSeedByte    = 0x07
	vectorBenchmarkID = "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a"
	vectorByteBudget  = 128 << 30
	vectorToken       = "k1.AdTl9qe4yU0OjxorPE1eb3oAAAAAas980AAAACAAAAAANY_K8eFnrMwKLxbk5nSD379ki706IxlEQ_rRgiSwyjXF5z47WfBNc5ux3KI_Jz20vDaMFpjawR2SIOdMzVX8Dw"
	vectorPublicSPKI  = "MCowBQYDK2VwAyEA6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0iw="
	pemPublicKeyType  = "PUBLIC KEY"
)

func vectorExpiresAt() time.Time {
	return time.Date(2026, time.October, 14, 13, 0, 0, 0, time.UTC)
}

type fixtureToken struct {
	keyID       string
	key         ed25519.PrivateKey
	benchmarkID uuid.UUID
	expiresAt   time.Time
	byteBudget  uint64
}

func vectorKey() ed25519.PrivateKey {
	return ed25519.NewKeyFromSeed(bytes.Repeat([]byte{vectorSeedByte}, ed25519.SeedSize))
}

func vectorFixture() fixtureToken {
	return fixtureToken{
		keyID:       vectorKeyID,
		key:         vectorKey(),
		benchmarkID: uuid.MustParse(vectorBenchmarkID),
		expiresAt:   vectorExpiresAt(),
		byteBudget:  vectorByteBudget,
	}
}

func (fixture fixtureToken) mint() string {
	payload := []byte{0x01}
	payload = append(payload, fixture.benchmarkID[:]...)
	payload = binary.BigEndian.AppendUint64(payload, uint64(fixture.expiresAt.Unix()))
	payload = binary.BigEndian.AppendUint64(payload, fixture.byteBudget)
	signed := append([]byte("snapflow.speedtest-token.v1"), 0x00)
	signed = append(signed, payload...)
	signature := ed25519.Sign(fixture.key, signed)
	return fixture.keyID + "." + base64.RawURLEncoding.EncodeToString(append(payload, signature...))
}

func publicKeyPEM(t *testing.T, key ed25519.PrivateKey) string {
	t.Helper()
	encoded, err := x509.MarshalPKIXPublicKey(key.Public())
	if err != nil {
		t.Fatal(err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: pemPublicKeyType, Bytes: encoded}))
}

type fakeKeySource struct {
	mutex   sync.Mutex
	keys    []apiclient.SpeedtestTokenKey
	err     error
	fetches atomic.Int32
}

func (source *fakeKeySource) SpeedtestTokenKeys(context.Context) ([]apiclient.SpeedtestTokenKey, error) {
	source.fetches.Add(1)
	source.mutex.Lock()
	defer source.mutex.Unlock()
	return append([]apiclient.SpeedtestTokenKey(nil), source.keys...), source.err
}

func (source *fakeKeySource) publish(t *testing.T, keyID string, key ed25519.PrivateKey) {
	t.Helper()
	source.mutex.Lock()
	defer source.mutex.Unlock()
	source.keys = append(source.keys, apiclient.SpeedtestTokenKey{KeyId: keyID, PublicKey: publicKeyPEM(t, key)})
}

func TestFixtureTokenMatchesTheProtocolVector(t *testing.T) {
	if token := vectorFixture().mint(); token != vectorToken {
		t.Fatalf("token = %s, want %s", token, vectorToken)
	}
	encoded, err := x509.MarshalPKIXPublicKey(vectorKey().Public())
	if err != nil {
		t.Fatal(err)
	}
	if spki := base64.StdEncoding.EncodeToString(encoded); spki != vectorPublicSPKI {
		t.Fatalf("public key = %s, want %s", spki, vectorPublicSPKI)
	}
}

func TestVerifyTokenAcceptsTheProtocolVector(t *testing.T) {
	source := &fakeKeySource{}
	source.publish(t, vectorKeyID, vectorKey())
	handler := newTestHandler(t, source, newTestClock(vectorExpiresAt().Add(-time.Hour)))
	claims, err := handler.verifyToken(t.Context(), vectorToken)
	if err != nil {
		t.Fatal(err)
	}
	if claims.benchmarkID.String() != vectorBenchmarkID || !claims.expiresAt.Equal(vectorExpiresAt()) || claims.byteBudget != vectorByteBudget {
		t.Fatalf("claims = %+v", claims)
	}
}

func TestVerifyTokenRejectsForgedAndExpiredTokens(t *testing.T) {
	source := &fakeKeySource{}
	source.publish(t, vectorKeyID, vectorKey())
	clock := newTestClock(vectorExpiresAt().Add(-time.Hour))
	handler := newTestHandler(t, source, clock)
	forged := vectorFixture()
	forged.key = ed25519.NewKeyFromSeed(bytes.Repeat([]byte{0x08}, ed25519.SeedSize))
	expired := vectorFixture()
	expired.expiresAt = clock.start.Add(-time.Second)
	cases := map[string]struct {
		token string
		want  error
	}{
		"no key id":     {token: "AdTl9qe4", want: errMalformedToken},
		"bad encoding":  {token: vectorKeyID + ".!!", want: errMalformedToken},
		"short payload": {token: vectorKeyID + "." + base64.RawURLEncoding.EncodeToString([]byte{0x01}), want: errMalformedToken},
		"forged":        {token: forged.mint(), want: errTokenSignature},
		"expired":       {token: expired.mint(), want: errTokenExpired},
	}
	for name, testCase := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := handler.verifyToken(t.Context(), testCase.token); !errors.Is(err, testCase.want) {
				t.Fatalf("error = %v, want %v", err, testCase.want)
			}
		})
	}
}

func TestUnknownKeyIDsRefetchTheKeysAtMostOncePerInterval(t *testing.T) {
	source := &fakeKeySource{}
	source.publish(t, vectorKeyID, vectorKey())
	clock := newTestClock(vectorExpiresAt().Add(-time.Hour))
	handler := newTestHandler(t, source, clock)
	rotated := vectorFixture()
	rotated.keyID = "k2"
	rotated.key = ed25519.NewKeyFromSeed(bytes.Repeat([]byte{0x09}, ed25519.SeedSize))
	if _, err := handler.verifyToken(t.Context(), rotated.mint()); !errors.Is(err, errUnknownTokenKey) {
		t.Fatalf("error = %v, want %v", err, errUnknownTokenKey)
	}
	source.publish(t, rotated.keyID, rotated.key)
	if _, err := handler.verifyToken(t.Context(), rotated.mint()); !errors.Is(err, errUnknownTokenKey) {
		t.Fatalf("error = %v, want %v", err, errUnknownTokenKey)
	}
	if fetches := source.fetches.Load(); fetches != 1 {
		t.Fatalf("fetches = %d, want 1", fetches)
	}
	clock.advance(keyRefetchInterval)
	if _, err := handler.verifyToken(t.Context(), rotated.mint()); err != nil {
		t.Fatal(err)
	}
	if _, err := handler.verifyToken(t.Context(), vectorToken); err != nil {
		t.Fatal(err)
	}
	if fetches := source.fetches.Load(); fetches != 2 {
		t.Fatalf("fetches = %d, want 2", fetches)
	}
}

func TestUnavailableKeysAreReportedAsSuch(t *testing.T) {
	source := &fakeKeySource{err: errors.New("api down")}
	handler := newTestHandler(t, source, newTestClock(vectorExpiresAt().Add(-time.Hour)))
	if _, err := handler.verifyToken(t.Context(), vectorToken); !errors.Is(err, errKeysUnavailable) {
		t.Fatalf("error = %v, want %v", err, errKeysUnavailable)
	}
}
