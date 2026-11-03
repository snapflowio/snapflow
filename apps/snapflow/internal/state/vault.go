// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

const keyReferenceBytes = 16

type Vault interface {
	Backend() string
	Put(context.Context, string, []byte) error
	Get(context.Context, string) ([]byte, error)
	Delete(context.Context, string) error
}

func newKeyReference() (string, error) {
	value := make([]byte, keyReferenceBytes)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate machine key reference: %w", err)
	}
	return hex.EncodeToString(value), nil
}

func validateKeyReference(reference string) error {
	if len(reference) != hex.EncodedLen(keyReferenceBytes) || strings.ToLower(reference) != reference {
		return errors.New("machine key reference is invalid")
	}
	decoded := make([]byte, keyReferenceBytes)
	if _, err := hex.Decode(decoded, []byte(reference)); err != nil {
		return errors.New("machine key reference is invalid")
	}
	return nil
}
