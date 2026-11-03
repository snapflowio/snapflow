// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestProofTransportBindsSessionTokenAndRequest(t *testing.T) {
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate signing key: %v", err)
	}
	const token = "machine-session-token"
	var observed *http.Request
	transport := newProofTransport(roundTripFunc(func(request *http.Request) (*http.Response, error) {
		observed = request
		return &http.Response{
			StatusCode: http.StatusNoContent,
			Body:       io.NopCloser(strings.NewReader("")),
			Header:     make(http.Header),
			Request:    request,
		}, nil
	}), privateKey)
	if err := transport.setSessionToken(token); err != nil {
		t.Fatalf("set session token: %v", err)
	}
	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "https://api.snapflow.test/api/jobs/poll?timeout=30", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	response, err := transport.RoundTrip(request)
	if err != nil {
		t.Fatalf("round trip: %v", err)
	}
	if err := response.Body.Close(); err != nil {
		t.Fatalf("close response: %v", err)
	}
	if observed == nil {
		t.Fatal("base transport did not receive a request")
	}
	if got := observed.Header.Get(authorizationHeader); got != MachineTokenType+" "+token {
		t.Fatalf("authorization header = %q", got)
	}
	claims := decodeProofClaims(t, observed.Header.Get(proofHeaderName))
	if claims.Method != http.MethodGet {
		t.Fatalf("proof method = %q", claims.Method)
	}
	if claims.TargetURI != "https://api.snapflow.test/api/jobs/poll" {
		t.Fatalf("proof target URI = %q", claims.TargetURI)
	}
	digest := sha256.Sum256([]byte(token))
	if want := base64.RawURLEncoding.EncodeToString(digest[:]); claims.AccessTokenHash != want {
		t.Fatalf("proof token hash = %q, want %q", claims.AccessTokenHash, want)
	}
}

func TestProofTransportOmitsSessionTokenForSessionCreation(t *testing.T) {
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate signing key: %v", err)
	}
	transport := newProofTransport(roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if got := request.Header.Get(authorizationHeader); got != "" {
			t.Fatalf("identity-only request included authorization %q", got)
		}
		claims := decodeProofClaims(t, request.Header.Get(proofHeaderName))
		if claims.AccessTokenHash != "" {
			t.Fatalf("identity-only proof included token hash %q", claims.AccessTokenHash)
		}
		return &http.Response{
			StatusCode: http.StatusNoContent,
			Body:       io.NopCloser(strings.NewReader("")),
			Header:     make(http.Header),
			Request:    request,
		}, nil
	}), privateKey)
	if err := transport.setSessionToken("must-not-be-sent"); err != nil {
		t.Fatalf("set session token: %v", err)
	}
	request, err := http.NewRequestWithContext(t.Context(), http.MethodPost, "https://api.snapflow.test/api/machines/session", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	response, err := transport.RoundTrip(request)
	if err != nil {
		t.Fatalf("round trip: %v", err)
	}
	if err := response.Body.Close(); err != nil {
		t.Fatalf("close response: %v", err)
	}
}

func decodeProofClaims(t *testing.T, proof string) proofClaims {
	t.Helper()
	parts := strings.Split(proof, ".")
	if len(parts) != 3 {
		t.Fatalf("proof has %d parts", len(parts))
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode proof claims: %v", err)
	}
	var claims proofClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		t.Fatalf("parse proof claims: %v", err)
	}
	return claims
}
