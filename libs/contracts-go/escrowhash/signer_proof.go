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
	"math/big"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/crypto"
)

const SignerProofTag = "authorizeSignerProof"

func SignerProofMessage(domain Domain, deadline *big.Int, customer common.Address) common.Hash {
	return crypto.Keccak256Hash(
		math.PaddedBigBytes(domain.ChainID, common.HashLength),
		domain.VerifyingContract.Bytes(),
		[]byte(SignerProofTag),
		math.PaddedBigBytes(deadline, common.HashLength),
		customer.Bytes(),
	)
}

func SignerProofDigest(domain Domain, deadline *big.Int, customer common.Address) common.Hash {
	return common.BytesToHash(accounts.TextHash(SignerProofMessage(domain, deadline, customer).Bytes()))
}

func RecoverSignerProofSigner(
	domain Domain, deadline *big.Int, customer common.Address, signature []byte,
) (common.Address, error) {
	return recoverAddress(SignerProofDigest(domain, deadline, customer), signature)
}
