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

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/snapflowio/contracts-go/escrow"
)

const voucherType = "Voucher(address customer,address host,address feeReceiver,uint16 feeBps,bytes32 salt," +
	"uint128 cumulativeAmount,uint64 timestamp,bytes32 metadata)"

type Voucher = escrow.Voucher

func VoucherDigest(domain Domain, voucher Voucher) (common.Hash, error) {
	encoded, err := encode(
		[]string{"bytes32", "address", "address", "address", "uint16", "bytes32", "uint128", "uint64", "bytes32"},
		typeHash(voucherType), voucher.Customer, voucher.Host, voucher.FeeReceiver, voucher.FeeBps, voucher.Salt,
		voucher.CumulativeAmount, voucher.Timestamp, voucher.Metadata,
	)
	if err != nil {
		return common.Hash{}, fmt.Errorf("encode voucher: %w", err)
	}
	return domain.typedDataDigest(crypto.Keccak256Hash(encoded))
}

func ChannelID(domain Domain, voucher Voucher) (common.Hash, error) {
	encoded, err := encode(
		[]string{"uint256", "address", "address", "address", "address", "uint16", "bytes32"},
		domain.ChainID, domain.VerifyingContract, voucher.Customer, voucher.Host, voucher.FeeReceiver, voucher.FeeBps,
		voucher.Salt,
	)
	if err != nil {
		return common.Hash{}, fmt.Errorf("encode channel id: %w", err)
	}
	return crypto.Keccak256Hash(encoded), nil
}

func RecoverVoucherSigner(domain Domain, voucher Voucher, signature []byte) (common.Address, error) {
	digest, err := VoucherDigest(domain, voucher)
	if err != nil {
		return common.Address{}, err
	}
	return recoverAddress(digest, signature)
}
