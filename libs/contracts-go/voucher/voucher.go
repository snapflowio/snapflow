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

// Package voucher hashes and verifies SnapflowEscrow vouchers exactly as the contract does (EIP-712).
package voucher

import (
	"errors"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/snapflowio/contracts-go/escrow"
)

const (
	// DomainName and DomainVersion match the EIP712 constructor arguments of SnapflowEscrow.
	DomainName    = "SnapflowEscrow"
	DomainVersion = "1"

	voucherType = "Voucher(bytes32 channelId,address customer,address host,uint256 hostAmount," +
		"uint256 feeAmount,uint256 serviceAmount,uint64 sequence,uint64 expiry)"
	domainType = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"

	signatureLength = 65
	recoveryIndex   = 64
	// legacyRecoveryOffset is added to the recovery id by Ethereum signers (v = 27 or 28).
	legacyRecoveryOffset = 27
)

// Voucher is the generated contract binding type, so field names and widths follow the ABI.
type Voucher = escrow.Voucher

// ErrInvalidSignature is returned when a signature is malformed or does not recover to a public key.
var ErrInvalidSignature = errors.New("invalid voucher signature")

var (
	voucherTypeHash = crypto.Keccak256Hash([]byte(voucherType))
	domainTypeHash  = crypto.Keccak256Hash([]byte(domainType))
	nameHash        = crypto.Keccak256Hash([]byte(DomainName))
	versionHash     = crypto.Keccak256Hash([]byte(DomainVersion))

	bytes32Type = mustType("bytes32")
	addressType = mustType("address")
	uint256Type = mustType("uint256")
	uint64Type  = mustType("uint64")
	stringType  = mustType("string")

	domainArguments = abi.Arguments{
		{Type: bytes32Type}, {Type: bytes32Type}, {Type: bytes32Type}, {Type: uint256Type}, {Type: addressType},
	}
	voucherArguments = abi.Arguments{
		{Type: bytes32Type}, {Type: bytes32Type}, {Type: addressType}, {Type: addressType},
		{Type: uint256Type}, {Type: uint256Type}, {Type: uint256Type}, {Type: uint64Type}, {Type: uint64Type},
	}
	channelArguments = abi.Arguments{{Type: addressType}, {Type: addressType}, {Type: stringType}}
)

// Domain identifies one deployment of the escrow.
type Domain struct {
	ChainID           *big.Int
	VerifyingContract common.Address
}

// Separator is the EIP-712 domain separator of the deployment.
func (d Domain) Separator() (common.Hash, error) {
	encoded, err := domainArguments.Pack(domainTypeHash, nameHash, versionHash, d.ChainID, d.VerifyingContract)
	if err != nil {
		return common.Hash{}, fmt.Errorf("encode domain: %w", err)
	}
	return crypto.Keccak256Hash(encoded), nil
}

// Digest is the hash the customer or its session key signs, identical to SnapflowEscrow.voucherDigest.
func Digest(domain Domain, v Voucher) (common.Hash, error) {
	separator, err := domain.Separator()
	if err != nil {
		return common.Hash{}, err
	}
	encoded, err := voucherArguments.Pack(
		voucherTypeHash, v.ChannelId, v.Customer, v.Host, v.HostAmount, v.FeeAmount, v.ServiceAmount, v.Sequence, v.Expiry,
	)
	if err != nil {
		return common.Hash{}, fmt.Errorf("encode voucher: %w", err)
	}
	structHash := crypto.Keccak256(encoded)
	return crypto.Keccak256Hash([]byte{0x19, 0x01}, separator.Bytes(), structHash), nil
}

// RecoverSigner returns the address that produced signature over the voucher.
func RecoverSigner(domain Domain, v Voucher, signature []byte) (common.Address, error) {
	if len(signature) != signatureLength {
		return common.Address{}, fmt.Errorf("%w: length %d", ErrInvalidSignature, len(signature))
	}
	digest, err := Digest(domain, v)
	if err != nil {
		return common.Address{}, err
	}
	normalized := append([]byte(nil), signature...)
	if normalized[recoveryIndex] >= legacyRecoveryOffset {
		normalized[recoveryIndex] -= legacyRecoveryOffset
	}
	publicKey, err := crypto.SigToPub(digest.Bytes(), normalized)
	if err != nil {
		return common.Address{}, fmt.Errorf("%w: %w", ErrInvalidSignature, err)
	}
	return crypto.PubkeyToAddress(*publicKey), nil
}

// ChannelID derives the channel for one sandbox lease, matching channelIdFor in @snapflow/contracts.
func ChannelID(customer, host common.Address, leaseID string) (common.Hash, error) {
	encoded, err := channelArguments.Pack(customer, host, leaseID)
	if err != nil {
		return common.Hash{}, fmt.Errorf("encode channel: %w", err)
	}
	return crypto.Keccak256Hash(encoded), nil
}

func mustType(name string) abi.Type {
	t, err := abi.NewType(name, "", nil)
	if err != nil {
		panic(fmt.Sprintf("abi type %s: %v", name, err))
	}
	return t
}
