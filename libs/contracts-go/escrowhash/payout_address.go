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

const payoutAddressType = "PayoutAddress(address host,address payout,uint256 nonce,uint256 deadline)"

type PayoutAddress struct {
	Host     common.Address
	Payout   common.Address
	Nonce    *big.Int
	Deadline *big.Int
}

func PayoutAddressDigest(domain Domain, change PayoutAddress) (common.Hash, error) {
	encoded, err := encode(
		[]string{"bytes32", "address", "address", "uint256", "uint256"},
		typeHash(payoutAddressType), change.Host, change.Payout, change.Nonce, change.Deadline,
	)
	if err != nil {
		return common.Hash{}, fmt.Errorf("encode payout address: %w", err)
	}
	return domain.typedDataDigest(crypto.Keccak256Hash(encoded))
}

func RecoverPayoutAddressSigner(domain Domain, change PayoutAddress, signature []byte) (common.Address, error) {
	digest, err := PayoutAddressDigest(domain, change)
	if err != nil {
		return common.Address{}, err
	}
	return recoverAddress(digest, signature)
}
