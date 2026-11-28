// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common/hexutil"
)

const (
	enrollmentProofDomain        = "snapflow.machine-enrollment.v1"
	enrollmentProofLineSeparator = "\n"
	enrollmentNonceBytes         = 24
	enrollmentProofTimePrecision = time.Millisecond
	chainIDBase                  = 10
)

type EnrollmentKeys struct {
	SigningKey ed25519.PrivateKey
	HostKey    *HostKey
}

type EnrollmentProof struct {
	Name              string
	IdentityPublicKey string
	HostAddress       string
	IssuedAt          time.Time
	Nonce             string
	IdentitySignature string
	HostSignature     string
}

type enrollmentClaim struct {
	name     string
	chainID  uint64
	issuedAt time.Time
	nonce    string
}

func GenerateEnrollmentKeys() (EnrollmentKeys, error) {
	_, signingKey, err := GenerateSigningKey()
	if err != nil {
		return EnrollmentKeys{}, err
	}
	hostKey, err := GenerateHostKey()
	if err != nil {
		return EnrollmentKeys{}, err
	}
	return EnrollmentKeys{SigningKey: signingKey, HostKey: hostKey}, nil
}

func (keys EnrollmentKeys) SignEnrollment(name string, chainID uint64, now time.Time) (EnrollmentProof, error) {
	nonce := make([]byte, enrollmentNonceBytes)
	if _, err := rand.Read(nonce); err != nil {
		return EnrollmentProof{}, fmt.Errorf("generate machine enrollment nonce: %w", err)
	}
	return keys.signEnrollment(enrollmentClaim{
		name: name, chainID: chainID,
		issuedAt: now.UTC().Truncate(enrollmentProofTimePrecision),
		nonce:    base64.RawURLEncoding.EncodeToString(nonce),
	})
}

func (keys EnrollmentKeys) signEnrollment(claim enrollmentClaim) (EnrollmentProof, error) {
	if strings.TrimSpace(claim.name) == "" || claim.chainID == 0 {
		return EnrollmentProof{}, errors.New("machine enrollment needs a name and a settlement chain")
	}
	if len(keys.SigningKey) != ed25519.PrivateKeySize || keys.HostKey == nil {
		return EnrollmentProof{}, errors.New("machine enrollment needs the identity key and the host key")
	}
	publicKey, err := signingPublicKey(keys.SigningKey)
	if err != nil {
		return EnrollmentProof{}, err
	}
	keyID, err := KeyID(publicKey)
	if err != nil {
		return EnrollmentProof{}, err
	}
	publicKeyPEM, err := PublicKeyPEM(publicKey)
	if err != nil {
		return EnrollmentProof{}, err
	}
	hostAddress := keys.HostKey.Address().Hex()
	message := enrollmentProofMessage(claim, keyID, hostAddress)
	hostSignature, err := keys.HostKey.SignMessage(message)
	if err != nil {
		return EnrollmentProof{}, err
	}
	return EnrollmentProof{
		Name:              claim.name,
		IdentityPublicKey: publicKeyPEM,
		HostAddress:       hostAddress,
		IssuedAt:          claim.issuedAt,
		Nonce:             claim.nonce,
		IdentitySignature: base64.RawURLEncoding.EncodeToString(ed25519.Sign(keys.SigningKey, message)),
		HostSignature:     hexutil.Encode(hostSignature),
	}, nil
}

func enrollmentProofMessage(claim enrollmentClaim, keyID, hostAddress string) []byte {
	return []byte(strings.Join([]string{
		enrollmentProofDomain,
		claim.name,
		keyID,
		hostAddress,
		strconv.FormatUint(claim.chainID, chainIDBase),
		claim.issuedAt.Format(time.RFC3339Nano),
		claim.nonce,
	}, enrollmentProofLineSeparator))
}

func signingPublicKey(privateKey ed25519.PrivateKey) (ed25519.PublicKey, error) {
	publicKey, ok := privateKey.Public().(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("machine signing key has no Ed25519 public key")
	}
	return publicKey, nil
}
