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
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	proofHeaderName      = "DPoP"
	authorizationHeader  = "Authorization"
	proofType            = "dpop+jwt"
	proofAlgorithm       = "EdDSA"
	proofKeyType         = "OKP"
	proofCurve           = "Ed25519"
	proofIdentifierBytes = 24
	sessionEndpointPath  = "/machines/session"
	identityStatusPath   = "/machines/identity/status"
)

type proofTransport struct {
	base       http.RoundTripper
	signingKey ed25519.PrivateKey
	tokenMu    sync.RWMutex
	token      string
}

type proofHeader struct {
	Type      string         `json:"typ"`
	Algorithm string         `json:"alg"`
	JWK       proofPublicKey `json:"jwk"`
}

type proofPublicKey struct {
	KeyType string `json:"kty"`
	Curve   string `json:"crv"`
	X       string `json:"x"`
}

type proofClaims struct {
	Identifier      string `json:"jti"`
	Method          string `json:"htm"`
	TargetURI       string `json:"htu"`
	IssuedAt        int64  `json:"iat"`
	AccessTokenHash string `json:"ath,omitempty"`
}

func newProofTransport(base http.RoundTripper, signingKey ed25519.PrivateKey) *proofTransport {
	keyCopy := append(ed25519.PrivateKey(nil), signingKey...)
	return &proofTransport{base: base, signingKey: keyCopy}
}

func (transport *proofTransport) setSessionToken(token string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return errors.New("machine session token is required")
	}
	transport.tokenMu.Lock()
	defer transport.tokenMu.Unlock()
	transport.token = token
	return nil
}

func (transport *proofTransport) clearSessionToken() {
	transport.tokenMu.Lock()
	defer transport.tokenMu.Unlock()
	transport.token = ""
}

func (transport *proofTransport) sessionToken() string {
	transport.tokenMu.RLock()
	defer transport.tokenMu.RUnlock()
	return transport.token
}

func (transport *proofTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if request == nil {
		return nil, errors.New("the Snapflow API request is required")
	}
	token := transport.sessionToken()
	if isIdentityOnlyRequest(request) {
		token = ""
	}
	proof, err := transport.sign(request, token)
	if err != nil {
		return nil, err
	}
	clone := request.Clone(request.Context())
	clone.Header = request.Header.Clone()
	clone.Header.Set(proofHeaderName, proof)
	if token != "" {
		clone.Header.Set(authorizationHeader, MachineTokenType+" "+token)
	}
	base := transport.base
	if base == nil {
		base = http.DefaultTransport
	}
	return base.RoundTrip(clone)
}

func isIdentityOnlyRequest(request *http.Request) bool {
	return request.Method == http.MethodPost &&
		(strings.HasSuffix(request.URL.Path, sessionEndpointPath) ||
			strings.HasSuffix(request.URL.Path, identityStatusPath))
}

func (transport *proofTransport) sign(request *http.Request, token string) (string, error) {
	identifier := make([]byte, proofIdentifierBytes)
	if _, err := rand.Read(identifier); err != nil {
		return "", fmt.Errorf("generate machine proof identifier: %w", err)
	}
	publicKey, ok := transport.signingKey.Public().(ed25519.PublicKey)
	if !ok || len(publicKey) != ed25519.PublicKeySize {
		return "", errors.New("derive machine proof public key")
	}
	header := proofHeader{
		Type: proofType, Algorithm: proofAlgorithm,
		JWK: proofPublicKey{
			KeyType: proofKeyType,
			Curve:   proofCurve,
			X:       base64.RawURLEncoding.EncodeToString(publicKey),
		},
	}
	target := *request.URL
	target.RawQuery = ""
	target.ForceQuery = false
	target.Fragment = ""
	claims := proofClaims{
		Identifier: base64.RawURLEncoding.EncodeToString(identifier),
		Method:     strings.ToUpper(request.Method),
		TargetURI:  target.String(),
		IssuedAt:   time.Now().Unix(),
	}
	if token != "" {
		digest := sha256.Sum256([]byte(token))
		claims.AccessTokenHash = base64.RawURLEncoding.EncodeToString(digest[:])
	}
	protectedPart, err := encodeProofPart(header)
	if err != nil {
		return "", fmt.Errorf("encode machine proof header: %w", err)
	}
	claimsPart, err := encodeProofPart(claims)
	if err != nil {
		return "", fmt.Errorf("encode machine proof claims: %w", err)
	}
	signingInput := protectedPart + "." + claimsPart
	signature := ed25519.Sign(transport.signingKey, []byte(signingInput))
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func encodeProofPart(value any) (string, error) {
	payload, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(payload), nil
}
