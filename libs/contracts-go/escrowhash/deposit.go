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
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

const depositAuthorizationTag = "SnapflowEscrow.depositWithAuthorization"

type DepositAuthorization struct {
	Payer       common.Address
	Customer    common.Address
	Relayer     common.Address
	Amount      *big.Int
	RelayFee    *big.Int
	ValidAfter  *big.Int
	ValidBefore *big.Int
	Salt        common.Hash
}

func DepositNonce(domain Domain, deposit DepositAuthorization) (common.Hash, error) {
	encoded, err := encode(
		[]string{
			"bytes32", "uint256", "address", "address", "address", "address", "uint256", "uint256", "uint256", "uint256",
			"bytes32",
		},
		typeHash(depositAuthorizationTag), domain.ChainID, domain.VerifyingContract, deposit.Payer, deposit.Customer,
		deposit.Relayer, deposit.Amount, deposit.RelayFee, deposit.ValidAfter, deposit.ValidBefore, deposit.Salt,
	)
	if err != nil {
		return common.Hash{}, fmt.Errorf("encode deposit nonce: %w", err)
	}
	return crypto.Keccak256Hash(encoded), nil
}
