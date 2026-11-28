// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package identity

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/statefile"
)

const (
	identitySeedFilename = "edge-identity-seed"
	keyIDPrefix          = "ed25519:"
	publicKeyPEMType     = "PUBLIC KEY"
)

type Identity struct {
	edgeID     string
	keyID      string
	publicKey  ed25519.PublicKey
	privateKey ed25519.PrivateKey
}

func LoadOrCreate(stateDirectory, edgeID string) (*Identity, error) {
	if uuid.Validate(edgeID) != nil {
		return nil, errors.New("edge identity requires a valid Edge ID")
	}
	seed, err := statefile.LoadOrCreateSecret(
		stateDirectory,
		identitySeedFilename,
		ed25519.SeedSize,
	)
	if err != nil {
		return nil, fmt.Errorf("load Edge identity seed: %w", err)
	}
	privateKey := ed25519.NewKeyFromSeed(seed)
	clear(seed)
	publicKey, valid := privateKey.Public().(ed25519.PublicKey)
	if !valid {
		clear(privateKey)
		return nil, errors.New("derive Edge public identity key")
	}
	keyID, err := deriveKeyID(publicKey)
	if err != nil {
		clear(privateKey)
		return nil, err
	}
	return &Identity{
		edgeID: edgeID, keyID: keyID,
		publicKey: publicKey, privateKey: privateKey,
	}, nil
}

func (identity *Identity) EdgeID() string { return identity.edgeID }

func (identity *Identity) KeyID() string { return identity.keyID }

func (identity *Identity) PublicKeyPEM() (string, error) {
	if identity == nil || len(identity.publicKey) != ed25519.PublicKeySize {
		return "", errors.New("edge public identity key is unavailable")
	}
	der, err := x509.MarshalPKIXPublicKey(identity.publicKey)
	if err != nil {
		return "", fmt.Errorf("encode Edge public identity key: %w", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: publicKeyPEMType, Bytes: der})), nil
}

func deriveKeyID(publicKey ed25519.PublicKey) (string, error) {
	if len(publicKey) != ed25519.PublicKeySize {
		return "", errors.New("valid Ed25519 public key is required")
	}
	der, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return "", fmt.Errorf("encode Edge identity key ID: %w", err)
	}
	digest := sha256.Sum256(der)
	return keyIDPrefix + hex.EncodeToString(digest[:]), nil
}
