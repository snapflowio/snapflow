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
	"encoding/pem"
	"errors"
	"fmt"
	"sync"
	"time"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const keyRefetchInterval = 30 * time.Second

var (
	errUnknownTokenKey  = errors.New("the speedtest token key is unknown")
	errKeysUnavailable  = errors.New("the speedtest token keys are unavailable")
	errMalformedKeyPEM  = errors.New("the speedtest token key is not PEM")
	errUnexpectedKeyAlg = errors.New("the speedtest token key is not Ed25519")
)

type KeySource interface {
	SpeedtestTokenKeys(ctx context.Context) ([]apiclient.SpeedtestTokenKey, error)
}

type keyring struct {
	source    KeySource
	now       func() time.Time
	mutex     sync.Mutex
	keys      map[string]ed25519.PublicKey
	fetchedAt time.Time
}

func (ring *keyring) publicKey(ctx context.Context, keyID string) (ed25519.PublicKey, error) {
	ring.mutex.Lock()
	defer ring.mutex.Unlock()
	if key, found := ring.keys[keyID]; found {
		return key, nil
	}
	now := ring.now()
	if !ring.fetchedAt.IsZero() && now.Sub(ring.fetchedAt) < keyRefetchInterval {
		return nil, errUnknownTokenKey
	}
	published, err := ring.source.SpeedtestTokenKeys(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", errKeysUnavailable, err)
	}
	keys := make(map[string]ed25519.PublicKey, len(published))
	for _, entry := range published {
		key, err := parsePublicKey(entry.PublicKey)
		if err != nil {
			return nil, fmt.Errorf("%w: key %s: %w", errKeysUnavailable, entry.KeyId, err)
		}
		keys[entry.KeyId] = key
	}
	ring.keys, ring.fetchedAt = keys, now
	if key, found := keys[keyID]; found {
		return key, nil
	}
	return nil, errUnknownTokenKey
}

func parsePublicKey(encoded string) (ed25519.PublicKey, error) {
	block, rest := pem.Decode([]byte(encoded))
	if block == nil || len(bytes.TrimSpace(rest)) > 0 {
		return nil, errMalformedKeyPEM
	}
	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse the SPKI public key: %w", err)
	}
	key, ok := parsed.(ed25519.PublicKey)
	if !ok {
		return nil, errUnexpectedKeyAlg
	}
	return key, nil
}
