// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package escrowhash

import (
	"errors"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

const (
	signatureLength      = 65
	scalarLength         = 32
	legacyRecoveryOffset = 27
)

var ErrInvalidSignature = errors.New("invalid signature")

func recoverAddress(digest common.Hash, signature []byte) (common.Address, error) {
	if len(signature) != signatureLength {
		return common.Address{}, fmt.Errorf("%w: length %d", ErrInvalidSignature, len(signature))
	}
	v := signature[crypto.RecoveryIDOffset]
	if v != legacyRecoveryOffset && v != legacyRecoveryOffset+1 {
		return common.Address{}, fmt.Errorf("%w: recovery id %d", ErrInvalidSignature, v)
	}
	recoveryID := v - legacyRecoveryOffset
	r := new(big.Int).SetBytes(signature[:scalarLength])
	s := new(big.Int).SetBytes(signature[scalarLength:crypto.RecoveryIDOffset])
	if !crypto.ValidateSignatureValues(recoveryID, r, s, true) {
		return common.Address{}, fmt.Errorf("%w: r or s out of range", ErrInvalidSignature)
	}
	normalized := append([]byte(nil), signature...)
	normalized[crypto.RecoveryIDOffset] = recoveryID
	publicKey, err := crypto.SigToPub(digest.Bytes(), normalized)
	if err != nil {
		return common.Address{}, fmt.Errorf("%w: %w", ErrInvalidSignature, err)
	}
	return crypto.PubkeyToAddress(*publicKey), nil
}
