// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"fmt"
	"math"
	"math/big"
	"strconv"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/snapflowio/contracts-go/escrowhash"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	decimalBase = 10
	uint64Bits  = 64
	uint128Bits = 128
	uint256Bits = 256
)

type signedVoucher struct {
	voucher   escrowhash.Voucher
	signer    common.Address
	signature []byte
}

func decodeDomain(domain apiclient.EscrowDomain) (escrowhash.Domain, error) {
	if domain.Name != escrowhash.DomainName || domain.Version != escrowhash.DomainVersion {
		return escrowhash.Domain{}, fmt.Errorf("unexpected escrow domain %s version %s", domain.Name, domain.Version)
	}
	if domain.ChainId <= 0 {
		return escrowhash.Domain{}, fmt.Errorf("invalid escrow chain id %d", domain.ChainId)
	}
	contract, err := decodeAddress("verifying contract", domain.VerifyingContract)
	if err != nil {
		return escrowhash.Domain{}, err
	}
	return escrowhash.Domain{ChainID: big.NewInt(int64(domain.ChainId)), VerifyingContract: contract}, nil
}

func decodeTerms(channel apiclient.MachineSettlementChannel) (escrowhash.Voucher, error) {
	var (
		terms escrowhash.Voucher
		err   error
	)
	if terms.Customer, err = decodeAddress("customer", channel.CustomerAddress); err != nil {
		return escrowhash.Voucher{}, err
	}
	if terms.Host, err = decodeAddress("host", channel.HostAddress); err != nil {
		return escrowhash.Voucher{}, err
	}
	if terms.FeeReceiver, err = decodeAddress("fee receiver", channel.FeeReceiverAddress); err != nil {
		return escrowhash.Voucher{}, err
	}
	if terms.FeeBps, err = decodeFeeBps(channel.FeeBps); err != nil {
		return escrowhash.Voucher{}, err
	}
	if terms.Salt, err = decodeHash("salt", channel.Salt); err != nil {
		return escrowhash.Voucher{}, err
	}
	return terms, nil
}

func decodeSigned(signed apiclient.MachineSignedVoucher) (signedVoucher, error) {
	var (
		decoded signedVoucher
		err     error
	)
	voucher := &decoded.voucher
	if voucher.Customer, err = decodeAddress("voucher customer", signed.Customer); err != nil {
		return signedVoucher{}, err
	}
	if voucher.Host, err = decodeAddress("voucher host", signed.Host); err != nil {
		return signedVoucher{}, err
	}
	if voucher.FeeReceiver, err = decodeAddress("voucher fee receiver", signed.FeeReceiver); err != nil {
		return signedVoucher{}, err
	}
	if voucher.FeeBps, err = decodeFeeBps(signed.FeeBps); err != nil {
		return signedVoucher{}, err
	}
	if voucher.Salt, err = decodeHash("voucher salt", signed.Salt); err != nil {
		return signedVoucher{}, err
	}
	if voucher.Metadata, err = decodeHash("metadata", signed.Metadata); err != nil {
		return signedVoucher{}, err
	}
	if voucher.CumulativeAmount, err = decodeAmount("cumulative amount", signed.CumulativeAmount); err != nil {
		return signedVoucher{}, err
	}
	if voucher.Timestamp, err = strconv.ParseUint(signed.Timestamp, decimalBase, uint64Bits); err != nil {
		return signedVoucher{}, fmt.Errorf("invalid voucher timestamp %q: %w", signed.Timestamp, err)
	}
	if decoded.signer, err = decodeAddress("signer", signed.Signer); err != nil {
		return signedVoucher{}, err
	}
	if decoded.signature, err = hexutil.Decode(signed.Signature); err != nil {
		return signedVoucher{}, fmt.Errorf("invalid voucher signature encoding: %w", err)
	}
	return decoded, nil
}

func decodeFeeBps(value int) (uint16, error) {
	if value < 0 || value > math.MaxUint16 {
		return 0, fmt.Errorf("invalid fee %d bps", value)
	}
	return uint16(value), nil
}

func decodeHash(name, value string) (common.Hash, error) {
	decoded, err := hexutil.Decode(value)
	if err != nil || len(decoded) != common.HashLength {
		return common.Hash{}, fmt.Errorf("invalid %s %q", name, value)
	}
	return common.BytesToHash(decoded), nil
}

func decodeAddress(name, value string) (common.Address, error) {
	if !common.IsHexAddress(value) {
		return common.Address{}, fmt.Errorf("invalid %s address %q", name, value)
	}
	return common.HexToAddress(value), nil
}

func decodeAmount(name, value string) (*big.Int, error) {
	return decodeUint(name, value, uint128Bits)
}

func decodeUint(name, value string, bits int) (*big.Int, error) {
	amount, valid := new(big.Int).SetString(value, decimalBase)
	if !valid || amount.Sign() < 0 || amount.BitLen() > bits {
		return nil, fmt.Errorf("invalid %s %q", name, value)
	}
	return amount, nil
}
