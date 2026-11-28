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

const hostWithdrawalType = "HostWithdrawal(address host,address payout,address relayer,uint256 relayFee," +
	"uint256 nonce,uint256 deadline)"

type HostWithdrawal struct {
	Host     common.Address
	Payout   common.Address
	Relayer  common.Address
	RelayFee *big.Int
	Nonce    *big.Int
	Deadline *big.Int
}

func HostWithdrawalDigest(domain Domain, withdrawal HostWithdrawal) (common.Hash, error) {
	encoded, err := encode(
		[]string{"bytes32", "address", "address", "address", "uint256", "uint256", "uint256"},
		typeHash(hostWithdrawalType), withdrawal.Host, withdrawal.Payout, withdrawal.Relayer, withdrawal.RelayFee,
		withdrawal.Nonce, withdrawal.Deadline,
	)
	if err != nil {
		return common.Hash{}, fmt.Errorf("encode host withdrawal: %w", err)
	}
	return domain.typedDataDigest(crypto.Keccak256Hash(encoded))
}

func RecoverHostWithdrawalSigner(
	domain Domain, withdrawal HostWithdrawal, signature []byte,
) (common.Address, error) {
	digest, err := HostWithdrawalDigest(domain, withdrawal)
	if err != nil {
		return common.Address{}, err
	}
	return recoverAddress(digest, signature)
}
