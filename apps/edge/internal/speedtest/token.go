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
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	tokenVersion          = 0x01
	tokenSignatureDomain  = "snapflow.speedtest-token.v1"
	tokenDomainSeparator  = 0x00
	tokenKeySeparator     = "."
	tokenVersionBytes     = 1
	tokenBenchmarkIDBytes = 16
	tokenUint64Bytes      = 8
	tokenPayloadBytes     = tokenVersionBytes + tokenBenchmarkIDBytes + 2*tokenUint64Bytes
	tokenBytes            = tokenPayloadBytes + ed25519.SignatureSize
)

var (
	errMalformedToken = errors.New("the speedtest token is malformed")
	errTokenSignature = errors.New("the speedtest token signature does not verify")
	errTokenExpired   = errors.New("the speedtest token has expired")
)

type tokenClaims struct {
	benchmarkID uuid.UUID
	expiresAt   time.Time
	byteBudget  uint64
}

type signedToken struct {
	keyID     string
	payload   []byte
	signature []byte
}

func parseToken(token string) (signedToken, error) {
	separator := strings.LastIndex(token, tokenKeySeparator)
	if separator <= 0 {
		return signedToken{}, errMalformedToken
	}
	decoded, err := base64.RawURLEncoding.DecodeString(token[separator+len(tokenKeySeparator):])
	if err != nil || len(decoded) != tokenBytes || decoded[0] != tokenVersion {
		return signedToken{}, errMalformedToken
	}
	return signedToken{
		keyID:     token[:separator],
		payload:   decoded[:tokenPayloadBytes],
		signature: decoded[tokenPayloadBytes:],
	}, nil
}

func tokenSignedBytes(payload []byte) []byte {
	return bytes.Join([][]byte{[]byte(tokenSignatureDomain), payload}, []byte{tokenDomainSeparator})
}

func (token signedToken) claims() (tokenClaims, error) {
	offset := tokenVersionBytes
	benchmarkID, err := uuid.FromBytes(token.payload[offset : offset+tokenBenchmarkIDBytes])
	if err != nil {
		return tokenClaims{}, errMalformedToken
	}
	offset += tokenBenchmarkIDBytes
	expiresAt := binary.BigEndian.Uint64(token.payload[offset : offset+tokenUint64Bytes])
	offset += tokenUint64Bytes
	if expiresAt > math.MaxInt64 {
		return tokenClaims{}, errMalformedToken
	}
	return tokenClaims{
		benchmarkID: benchmarkID,
		expiresAt:   time.Unix(int64(expiresAt), 0),
		byteBudget:  binary.BigEndian.Uint64(token.payload[offset : offset+tokenUint64Bytes]),
	}, nil
}

func (handler *Handler) verifyToken(ctx context.Context, token string) (tokenClaims, error) {
	parsed, err := parseToken(token)
	if err != nil {
		return tokenClaims{}, err
	}
	publicKey, err := handler.keys.publicKey(ctx, parsed.keyID)
	if err != nil {
		return tokenClaims{}, err
	}
	if !ed25519.Verify(publicKey, tokenSignedBytes(parsed.payload), parsed.signature) {
		return tokenClaims{}, errTokenSignature
	}
	claims, err := parsed.claims()
	if err != nil {
		return tokenClaims{}, err
	}
	if !handler.now().Before(claims.expiresAt) {
		return tokenClaims{}, fmt.Errorf("%w at %s", errTokenExpired, claims.expiresAt.UTC().Format(time.RFC3339))
	}
	return claims, nil
}
