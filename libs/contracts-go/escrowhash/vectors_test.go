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

package escrowhash_test

import (
	"encoding/json"
	"errors"
	"math/big"
	"os"
	"strconv"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"

	"github.com/snapflowio/contracts-go/escrowhash"
)

const (
	vectorsPath      = "../../../apps/contracts/test/vectors/vouchers.json"
	supportedVersion = "2"
	decimalBase      = 10
	uint16Bits       = 16
	uint64Bits       = 64
)

type named struct {
	Name string `json:"name"`
}

type signed struct {
	Digest    common.Hash   `json:"digest"`
	Signature hexutil.Bytes `json:"signature"`
}

type voucherVector struct {
	named
	Customer         common.Address `json:"customer"`
	Host             common.Address `json:"host"`
	FeeReceiver      common.Address `json:"feeReceiver"`
	FeeBps           string         `json:"feeBps"`
	Salt             common.Hash    `json:"salt"`
	CumulativeAmount string         `json:"cumulativeAmount"`
	Timestamp        string         `json:"timestamp"`
	Metadata         common.Hash    `json:"metadata"`
	ChannelID        common.Hash    `json:"channelId"`
	signed
}

type signerProofVector struct {
	named
	Customer common.Address `json:"customer"`
	Deadline string         `json:"deadline"`
	signed
}

type hostWithdrawalVector struct {
	named
	Host     common.Address `json:"host"`
	Payout   common.Address `json:"payout"`
	Relayer  common.Address `json:"relayer"`
	RelayFee string         `json:"relayFee"`
	Nonce    string         `json:"nonce"`
	Deadline string         `json:"deadline"`
	signed
}

type payoutAddressVector struct {
	named
	Host     common.Address `json:"host"`
	Payout   common.Address `json:"payout"`
	Nonce    string         `json:"nonce"`
	Deadline string         `json:"deadline"`
	signed
}

type depositNonceVector struct {
	named
	Payer       common.Address `json:"payer"`
	Customer    common.Address `json:"customer"`
	Relayer     common.Address `json:"relayer"`
	Amount      string         `json:"amount"`
	RelayFee    string         `json:"relayFee"`
	ValidAfter  string         `json:"validAfter"`
	ValidBefore string         `json:"validBefore"`
	Salt        common.Hash    `json:"salt"`
	Nonce       common.Hash    `json:"nonce"`
}

type invalidSignatureVector struct {
	named
	Voucher   string        `json:"voucher"`
	Signature hexutil.Bytes `json:"signature"`
}

type vectorFile struct {
	Version                  string                   `json:"version"`
	ChainID                  int64                    `json:"chainId"`
	VerifyingContract        common.Address           `json:"verifyingContract"`
	DomainName               string                   `json:"domainName"`
	DomainVersion            string                   `json:"domainVersion"`
	Signer                   common.Address           `json:"signer"`
	Host                     common.Address           `json:"host"`
	Vouchers                 []voucherVector          `json:"vouchers"`
	SignerProofs             []signerProofVector      `json:"signerProofs"`
	HostWithdrawals          []hostWithdrawalVector   `json:"hostWithdrawals"`
	PayoutAddresses          []payoutAddressVector    `json:"payoutAddresses"`
	DepositNonces            []depositNonceVector     `json:"depositNonces"`
	InvalidVoucherSignatures []invalidSignatureVector `json:"invalidVoucherSignatures"`
}

func loadVectors(t *testing.T) (vectorFile, escrowhash.Domain) {
	t.Helper()
	raw, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("read vectors: %v", err)
	}
	var vectors vectorFile
	if err := json.Unmarshal(raw, &vectors); err != nil {
		t.Fatalf("decode vectors: %v", err)
	}
	domain := escrowhash.Domain{ChainID: big.NewInt(vectors.ChainID), VerifyingContract: vectors.VerifyingContract}
	return vectors, domain
}

func decimal(t *testing.T, value string) *big.Int {
	t.Helper()
	n, ok := new(big.Int).SetString(value, decimalBase)
	if !ok {
		t.Fatalf("invalid decimal %q", value)
	}
	return n
}

func unsigned(t *testing.T, value string, bits int) uint64 {
	t.Helper()
	n, err := strconv.ParseUint(value, decimalBase, bits)
	if err != nil {
		t.Fatalf("invalid uint%d %q: %v", bits, value, err)
	}
	return n
}

func expectSigned(t *testing.T, digest, wantDigest common.Hash, recovered, wantSigner common.Address) {
	t.Helper()
	if digest != wantDigest {
		t.Fatalf("digest = %s, want %s", digest, wantDigest)
	}
	if recovered != wantSigner {
		t.Fatalf("signer = %s, want %s", recovered, wantSigner)
	}
}

func (v voucherVector) voucher(t *testing.T) escrowhash.Voucher {
	t.Helper()
	return escrowhash.Voucher{
		Customer:         v.Customer,
		Host:             v.Host,
		FeeReceiver:      v.FeeReceiver,
		FeeBps:           uint16(unsigned(t, v.FeeBps, uint16Bits)),
		Salt:             v.Salt,
		CumulativeAmount: decimal(t, v.CumulativeAmount),
		Timestamp:        unsigned(t, v.Timestamp, uint64Bits),
		Metadata:         v.Metadata,
	}
}

func TestHeaderMatchesContractVectors(t *testing.T) {
	vectors, _ := loadVectors(t)
	if vectors.Version != supportedVersion {
		t.Fatalf("vectors version = %s, want %s", vectors.Version, supportedVersion)
	}
	if escrowhash.DomainName != vectors.DomainName || escrowhash.DomainVersion != vectors.DomainVersion {
		t.Fatalf("domain = %s %s, want %s %s",
			escrowhash.DomainName, escrowhash.DomainVersion, vectors.DomainName, vectors.DomainVersion)
	}
}

func TestVouchersMatchContractVectors(t *testing.T) {
	vectors, domain := loadVectors(t)
	for _, entry := range vectors.Vouchers {
		t.Run(entry.Name, func(t *testing.T) {
			voucher := entry.voucher(t)
			digest, err := escrowhash.VoucherDigest(domain, voucher)
			if err != nil {
				t.Fatalf("digest: %v", err)
			}
			signer, err := escrowhash.RecoverVoucherSigner(domain, voucher, entry.Signature)
			if err != nil {
				t.Fatalf("recover: %v", err)
			}
			expectSigned(t, digest, entry.Digest, signer, vectors.Signer)
			channelID, err := escrowhash.ChannelID(domain, voucher)
			if err != nil {
				t.Fatalf("channel id: %v", err)
			}
			if channelID != entry.ChannelID {
				t.Fatalf("channel id = %s, want %s", channelID, entry.ChannelID)
			}
		})
	}
}

func TestSignerProofsMatchContractVectors(t *testing.T) {
	vectors, domain := loadVectors(t)
	for _, entry := range vectors.SignerProofs {
		t.Run(entry.Name, func(t *testing.T) {
			deadline := decimal(t, entry.Deadline)
			signer, err := escrowhash.RecoverSignerProofSigner(domain, deadline, entry.Customer, entry.Signature)
			if err != nil {
				t.Fatalf("recover: %v", err)
			}
			digest := escrowhash.SignerProofDigest(domain, deadline, entry.Customer)
			expectSigned(t, digest, entry.Digest, signer, vectors.Signer)
		})
	}
}

func TestHostWithdrawalsMatchContractVectors(t *testing.T) {
	vectors, domain := loadVectors(t)
	for _, entry := range vectors.HostWithdrawals {
		t.Run(entry.Name, func(t *testing.T) {
			withdrawal := escrowhash.HostWithdrawal{
				Host:     entry.Host,
				Payout:   entry.Payout,
				Relayer:  entry.Relayer,
				RelayFee: decimal(t, entry.RelayFee),
				Nonce:    decimal(t, entry.Nonce),
				Deadline: decimal(t, entry.Deadline),
			}
			digest, err := escrowhash.HostWithdrawalDigest(domain, withdrawal)
			if err != nil {
				t.Fatalf("digest: %v", err)
			}
			host, err := escrowhash.RecoverHostWithdrawalSigner(domain, withdrawal, entry.Signature)
			if err != nil {
				t.Fatalf("recover: %v", err)
			}
			expectSigned(t, digest, entry.Digest, host, vectors.Host)
		})
	}
}

func TestPayoutAddressesMatchContractVectors(t *testing.T) {
	vectors, domain := loadVectors(t)
	for _, entry := range vectors.PayoutAddresses {
		t.Run(entry.Name, func(t *testing.T) {
			change := escrowhash.PayoutAddress{
				Host:     entry.Host,
				Payout:   entry.Payout,
				Nonce:    decimal(t, entry.Nonce),
				Deadline: decimal(t, entry.Deadline),
			}
			digest, err := escrowhash.PayoutAddressDigest(domain, change)
			if err != nil {
				t.Fatalf("digest: %v", err)
			}
			host, err := escrowhash.RecoverPayoutAddressSigner(domain, change, entry.Signature)
			if err != nil {
				t.Fatalf("recover: %v", err)
			}
			expectSigned(t, digest, entry.Digest, host, vectors.Host)
		})
	}
}

func TestDepositNoncesMatchContractVectors(t *testing.T) {
	vectors, domain := loadVectors(t)
	for _, entry := range vectors.DepositNonces {
		t.Run(entry.Name, func(t *testing.T) {
			got, err := escrowhash.DepositNonce(domain, escrowhash.DepositAuthorization{
				Payer:       entry.Payer,
				Customer:    entry.Customer,
				Relayer:     entry.Relayer,
				Amount:      decimal(t, entry.Amount),
				RelayFee:    decimal(t, entry.RelayFee),
				ValidAfter:  decimal(t, entry.ValidAfter),
				ValidBefore: decimal(t, entry.ValidBefore),
				Salt:        entry.Salt,
			})
			if err != nil {
				t.Fatalf("deposit nonce: %v", err)
			}
			if got != entry.Nonce {
				t.Fatalf("deposit nonce = %s, want %s", got, entry.Nonce)
			}
		})
	}
}

func TestInvalidVoucherSignaturesAreRejected(t *testing.T) {
	vectors, domain := loadVectors(t)
	for _, entry := range vectors.InvalidVoucherSignatures {
		t.Run(entry.Name, func(t *testing.T) {
			index := unsigned(t, entry.Voucher, uint64Bits)
			if index >= uint64(len(vectors.Vouchers)) {
				t.Fatalf("voucher %d is not in the vectors", index)
			}
			voucher := vectors.Vouchers[index].voucher(t)
			signer, err := escrowhash.RecoverVoucherSigner(domain, voucher, entry.Signature)
			if err != nil && !errors.Is(err, escrowhash.ErrInvalidSignature) {
				t.Fatalf("recover: %v", err)
			}
			if err == nil && signer == vectors.Signer {
				t.Fatalf("accepted a signature the contract rejects")
			}
		})
	}
}
