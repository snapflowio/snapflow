// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package access

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	tokenVersion       = 2
	tokenUUIDBytes     = 16
	tokenNonceBytes    = 16
	tokenExpiryBytes   = 8
	tokenVersionOffset = 0
	tokenBackendOffset = tokenVersionOffset + 1
	tokenSessionOffset = tokenBackendOffset + tokenUUIDBytes
	tokenExpiryOffset  = tokenSessionOffset + tokenUUIDBytes
	tokenNonceOffset   = tokenExpiryOffset + tokenExpiryBytes
	tokenPayloadBytes  = tokenNonceOffset + tokenNonceBytes
	tokenSignedBytes   = tokenPayloadBytes + sha256.Size
)

func (gate *Gate) signToken(
	backendID uuid.UUID,
	sessionID uuid.UUID,
	expiresAt time.Time,
) (string, error) {
	token := make([]byte, tokenSignedBytes)
	token[tokenVersionOffset] = tokenVersion
	copy(token[tokenBackendOffset:tokenSessionOffset], backendID[:])
	copy(token[tokenSessionOffset:tokenExpiryOffset], sessionID[:])
	binary.BigEndian.PutUint64(
		token[tokenExpiryOffset:tokenNonceOffset],
		uint64(expiresAt.Unix()),
	)
	if _, err := rand.Read(token[tokenNonceOffset:tokenPayloadBytes]); err != nil {
		return "", fmt.Errorf("generate protected access nonce: %w", err)
	}
	signature, err := gate.mac(token[:tokenPayloadBytes])
	if err != nil {
		return "", err
	}
	copy(token[tokenPayloadBytes:], signature)
	return base64.RawURLEncoding.EncodeToString(token), nil
}

func (gate *Gate) verifyToken(
	encoded string,
	backendID uuid.UUID,
	now time.Time,
) (time.Time, uuid.UUID, bool) {
	if len(encoded) != base64.RawURLEncoding.EncodedLen(tokenSignedBytes) {
		return time.Time{}, uuid.Nil, false
	}
	token, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil ||
		len(token) != tokenSignedBytes ||
		base64.RawURLEncoding.EncodeToString(token) != encoded ||
		token[tokenVersionOffset] != tokenVersion {
		return time.Time{}, uuid.Nil, false
	}
	signature, err := gate.mac(token[:tokenPayloadBytes])
	if err != nil || !hmac.Equal(token[tokenPayloadBytes:], signature) {
		return time.Time{}, uuid.Nil, false
	}
	tokenBackendID, err := uuid.FromBytes(token[tokenBackendOffset:tokenSessionOffset])
	if err != nil || tokenBackendID != backendID {
		return time.Time{}, uuid.Nil, false
	}
	sessionID, err := uuid.FromBytes(token[tokenSessionOffset:tokenExpiryOffset])
	if err != nil || sessionID == uuid.Nil {
		return time.Time{}, uuid.Nil, false
	}
	expiresAt := time.Unix(
		int64(binary.BigEndian.Uint64(token[tokenExpiryOffset:tokenNonceOffset])),
		0,
	)
	if !now.Before(expiresAt) {
		return time.Time{}, uuid.Nil, false
	}
	return expiresAt, sessionID, true
}

func (gate *Gate) mac(payload []byte) ([]byte, error) {
	signature := hmac.New(sha256.New, gate.signingKey)
	if _, err := signature.Write(payload); err != nil {
		return nil, fmt.Errorf("sign protected access session: %w", err)
	}
	return signature.Sum(nil), nil
}
