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

const (
	DomainName    = "SnapflowEscrow"
	DomainVersion = "3"

	domainType      = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
	typedDataPrefix = "\x19\x01"
)

type Domain struct {
	ChainID           *big.Int
	VerifyingContract common.Address
}

func (d Domain) Separator() (common.Hash, error) {
	encoded, err := encode(
		[]string{"bytes32", "bytes32", "bytes32", "uint256", "address"},
		typeHash(domainType), typeHash(DomainName), typeHash(DomainVersion), d.ChainID, d.VerifyingContract,
	)
	if err != nil {
		return common.Hash{}, fmt.Errorf("encode domain: %w", err)
	}
	return crypto.Keccak256Hash(encoded), nil
}

func (d Domain) typedDataDigest(structHash common.Hash) (common.Hash, error) {
	separator, err := d.Separator()
	if err != nil {
		return common.Hash{}, err
	}
	return crypto.Keccak256Hash([]byte(typedDataPrefix), separator.Bytes(), structHash.Bytes()), nil
}

func typeHash(value string) common.Hash {
	return crypto.Keccak256Hash([]byte(value))
}
