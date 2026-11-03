// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

// Package accesstest issues registry tokens the way the api does, from a local
// Ed25519 key published through an in-process JWKS endpoint.
package accesstest

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	Issuer   = "snapflow-api"
	Audience = "snapflow-registry"
	KeyID    = "snapflow-registry-v1"

	tokenLifetime  = time.Hour
	resourceType   = "repository"
	contentType    = "Content-Type"
	jsonMediaType  = "application/json"
	keyTypeOKP     = "OKP"
	curveEd25519   = "Ed25519"
	algorithmEdDSA = "EdDSA"
	keyUseSign     = "sig"
)

// Entry is one repository grant; a name ending in "/*" covers a namespace.
type Entry struct {
	Name    string   `json:"name"`
	Actions []string `json:"actions"`
	Type    string   `json:"type"`
}

func Pull(name string) Entry { return Entry{Name: name, Actions: []string{"pull"}, Type: resourceType} }

func Push(name string) Entry {
	return Entry{Name: name, Actions: []string{"pull", "push"}, Type: resourceType}
}

type claims struct {
	jwt.RegisteredClaims
	Access []Entry `json:"access"`
}

type TokenIssuer struct {
	key    ed25519.PrivateKey
	server *httptest.Server
}

func NewIssuer(t testing.TB) *TokenIssuer {
	t.Helper()
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate registry token key: %v", err)
	}
	keySet, err := json.Marshal(map[string]any{"keys": []map[string]string{{
		"kty": keyTypeOKP,
		"crv": curveEd25519,
		"alg": algorithmEdDSA,
		"use": keyUseSign,
		"kid": KeyID,
		"x":   base64.RawURLEncoding.EncodeToString(public),
	}}})
	if err != nil {
		t.Fatalf("encode registry token key set: %v", err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(contentType, jsonMediaType)
		if _, err := w.Write(keySet); err != nil {
			t.Errorf("write registry token key set: %v", err)
		}
	}))
	t.Cleanup(server.Close)
	return &TokenIssuer{key: private, server: server}
}

func (issuer *TokenIssuer) JWKSURL() string { return issuer.server.URL }

// Token signs a valid token for subject; Sign customises the claims.
func (issuer *TokenIssuer) Token(t testing.TB, subject string, entries ...Entry) string {
	t.Helper()
	now := time.Now()
	return issuer.Sign(t, jwt.RegisteredClaims{
		Issuer:    Issuer,
		Audience:  jwt.ClaimStrings{Audience},
		Subject:   subject,
		ID:        uuid.NewString(),
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(tokenLifetime)),
	}, entries...)
}

func (issuer *TokenIssuer) Sign(t testing.TB, registered jwt.RegisteredClaims, entries ...Entry) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims{RegisteredClaims: registered, Access: entries})
	token.Header["kid"] = KeyID
	signed, err := token.SignedString(issuer.key)
	if err != nil {
		t.Fatalf("sign registry token: %v", err)
	}
	return signed
}
