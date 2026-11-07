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

package voucher_test

import (
	"encoding/json"
	"errors"
	"math/big"
	"os"
	"strconv"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"

	"github.com/snapflowio/contracts-go/voucher"
)

const (
	vectorsPath = "../../../apps/contracts/test/vectors/vouchers.json"
	decimalBase = 10
	uint64Bits  = 64
)

type vectorEntry struct {
	ChannelID     common.Hash    `json:"channelId"`
	Customer      common.Address `json:"customer"`
	Host          common.Address `json:"host"`
	HostAmount    string         `json:"hostAmount"`
	FeeAmount     string         `json:"feeAmount"`
	ServiceAmount string         `json:"serviceAmount"`
	Sequence      string         `json:"sequence"`
	Expiry        string         `json:"expiry"`
	Digest        common.Hash    `json:"digest"`
	Signature     hexutil.Bytes  `json:"signature"`
}

type vectorChannel struct {
	Customer  common.Address `json:"customer"`
	Host      common.Address `json:"host"`
	LeaseID   string         `json:"leaseId"`
	ChannelID common.Hash    `json:"channelId"`
}

type vectorFile struct {
	ChainID           int64           `json:"chainId"`
	VerifyingContract common.Address  `json:"verifyingContract"`
	Signer            common.Address  `json:"signer"`
	Vouchers          []vectorEntry   `json:"vouchers"`
	Channels          []vectorChannel `json:"channels"`
}

func loadVectors(t *testing.T) vectorFile {
	t.Helper()
	raw, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("read vectors: %v", err)
	}
	var vectors vectorFile
	if err := json.Unmarshal(raw, &vectors); err != nil {
		t.Fatalf("decode vectors: %v", err)
	}
	return vectors
}

func decimal(t *testing.T, value string) *big.Int {
	t.Helper()
	n, ok := new(big.Int).SetString(value, decimalBase)
	if !ok {
		t.Fatalf("invalid decimal %q", value)
	}
	return n
}

func unsigned(t *testing.T, value string) uint64 {
	t.Helper()
	n, err := strconv.ParseUint(value, decimalBase, uint64Bits)
	if err != nil {
		t.Fatalf("invalid uint64 %q: %v", value, err)
	}
	return n
}

func (e vectorEntry) voucher(t *testing.T) voucher.Voucher {
	return voucher.Voucher{
		ChannelId:     [32]byte(e.ChannelID),
		Customer:      e.Customer,
		Host:          e.Host,
		HostAmount:    decimal(t, e.HostAmount),
		FeeAmount:     decimal(t, e.FeeAmount),
		ServiceAmount: decimal(t, e.ServiceAmount),
		Sequence:      unsigned(t, e.Sequence),
		Expiry:        unsigned(t, e.Expiry),
	}
}

func TestDigestAndSignerMatchContractVectors(t *testing.T) {
	vectors := loadVectors(t)
	domain := voucher.Domain{ChainID: big.NewInt(vectors.ChainID), VerifyingContract: vectors.VerifyingContract}

	for _, entry := range vectors.Vouchers {
		t.Run("sequence "+entry.Sequence, func(t *testing.T) {
			v := entry.voucher(t)
			digest, err := voucher.Digest(domain, v)
			if err != nil {
				t.Fatalf("digest: %v", err)
			}
			if digest != entry.Digest {
				t.Fatalf("digest = %s, want %s", digest, entry.Digest)
			}
			signer, err := voucher.RecoverSigner(domain, v, entry.Signature)
			if err != nil {
				t.Fatalf("recover: %v", err)
			}
			if signer != vectors.Signer {
				t.Fatalf("signer = %s, want %s", signer, vectors.Signer)
			}
		})
	}
}

func TestRecoverSignerRejectsMalformedSignature(t *testing.T) {
	vectors := loadVectors(t)
	domain := voucher.Domain{ChainID: big.NewInt(vectors.ChainID), VerifyingContract: vectors.VerifyingContract}
	entry := vectors.Vouchers[0]

	_, err := voucher.RecoverSigner(domain, entry.voucher(t), entry.Signature[:len(entry.Signature)-1])
	if !errors.Is(err, voucher.ErrInvalidSignature) {
		t.Fatalf("error = %v, want ErrInvalidSignature", err)
	}
}

func TestChannelIDMatchesContractVectors(t *testing.T) {
	for _, channel := range loadVectors(t).Channels {
		got, err := voucher.ChannelID(channel.Customer, channel.Host, channel.LeaseID)
		if err != nil {
			t.Fatalf("channel id for %q: %v", channel.LeaseID, err)
		}
		if got != channel.ChannelID {
			t.Fatalf("channel id for %q = %s, want %s", channel.LeaseID, got, channel.ChannelID)
		}
	}
}
