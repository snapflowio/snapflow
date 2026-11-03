// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package identity

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	enrollmentProofDomain = "snapflow.edge-enrollment.v1"
	sessionProofDomain    = "snapflow.edge-session.v1"
	proofNonceBytes       = 24
	proofFieldSeparator   = "\n"
)

type Proof struct {
	IssuedAt  time.Time
	Nonce     string
	Signature string
}

func (identity *Identity) EnrollmentProof(now time.Time) (Proof, error) {
	return identity.proof(enrollmentProofDomain, now)
}

func (identity *Identity) SessionProof(now time.Time) (Proof, error) {
	return identity.proof(sessionProofDomain, now)
}

func (identity *Identity) Sign(payload []byte) (string, error) {
	if identity == nil || len(identity.privateKey) != ed25519.PrivateKeySize {
		return "", errors.New("valid Edge identity is required")
	}
	if len(payload) == 0 {
		return "", errors.New("edge signing payload is required")
	}
	return base64.RawURLEncoding.EncodeToString(
		ed25519.Sign(identity.privateKey, payload),
	), nil
}

func (identity *Identity) proof(domain string, now time.Time) (Proof, error) {
	if identity == nil || uuid.Validate(identity.edgeID) != nil ||
		identity.keyID == "" || len(identity.privateKey) != ed25519.PrivateKeySize {
		return Proof{}, errors.New("valid Edge identity is required")
	}
	nonceBytes := make([]byte, proofNonceBytes)
	if _, err := rand.Read(nonceBytes); err != nil {
		return Proof{}, fmt.Errorf("generate Edge identity proof nonce: %w", err)
	}
	issuedAt := now.UTC()
	nonce := base64.RawURLEncoding.EncodeToString(nonceBytes)
	payload := strings.Join([]string{
		domain,
		identity.edgeID,
		identity.keyID,
		issuedAt.Format(time.RFC3339Nano),
		nonce,
	}, proofFieldSeparator)
	return Proof{
		IssuedAt: issuedAt,
		Nonce:    nonce,
		Signature: base64.RawURLEncoding.EncodeToString(
			ed25519.Sign(identity.privateKey, []byte(payload)),
		),
	}, nil
}
