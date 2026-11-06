// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"encoding/json"
	"errors"
	"os"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/google/uuid"
	"github.com/snapflowio/contracts-go/voucher"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const vectorsPath = "../../../contracts/test/vectors/vouchers.json"

type vectorChannel struct {
	Customer  string `json:"customer"`
	Host      string `json:"host"`
	LeaseID   string `json:"leaseId"`
	ChannelID string `json:"channelId"`
}

// vectorFile mirrors the shared cross-language vectors; their voucher fields
// are the same decimal and hex strings the API serves.
type vectorFile struct {
	ChainID           int                              `json:"chainId"`
	VerifyingContract string                           `json:"verifyingContract"`
	Signer            string                           `json:"signer"`
	Vouchers          []apiclient.MachineSignedVoucher `json:"vouchers"`
	Channels          []vectorChannel                  `json:"channels"`
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

func TestSharedVectorsRecoverTheirSignerFromAPIStrings(t *testing.T) {
	vectors := loadVectors(t)
	domain, err := decodeDomain(apiclient.EscrowDomain{
		ChainId: vectors.ChainID, Name: voucher.DomainName, Version: voucher.DomainVersion,
		VerifyingContract: vectors.VerifyingContract,
	})
	if err != nil {
		t.Fatalf("decode domain: %v", err)
	}
	for index, signed := range vectors.Vouchers {
		signed.Signer = vectors.Signer
		decoded, err := decodeSigned(signed)
		if err != nil {
			t.Fatalf("decode vector %d: %v", index, err)
		}
		signer, err := voucher.RecoverSigner(domain, decoded.voucher, decoded.signature)
		if err != nil || signer != decoded.signer {
			t.Fatalf("vector %d recovers %s (%v), want %s", index, signer, err, decoded.signer)
		}
	}
}

func TestSharedVectorsDeriveTheirChannelFromTheLease(t *testing.T) {
	for _, channel := range loadVectors(t).Channels {
		leaseID, err := uuid.Parse(channel.LeaseID)
		if err != nil {
			// The API types leases as UUIDs, so other lease vectors cannot reach the machine.
			continue
		}
		listed := apiclient.MachineVoucherChannel{ChannelId: channel.ChannelID, LeaseId: leaseID}
		received, err := decodeSigned(apiclient.MachineSignedVoucher{
			ChannelId: channel.ChannelID, Customer: channel.Customer, Host: channel.Host, Signer: channel.Customer,
			HostAmount: "0", FeeAmount: "0", ServiceAmount: "0", Sequence: "1", Expiry: "1", Signature: "0x",
		})
		if err != nil {
			t.Fatalf("decode channel vector: %v", err)
		}
		if err := verifyChannel(listed, received.voucher); err != nil {
			t.Fatalf("channel vector of lease %s: %v", channel.LeaseID, err)
		}
	}
}

func TestVerifyRejectsEveryBrokenRule(t *testing.T) {
	signer := newSigner(t)
	channelID := testChannelID(t, testLeaseID)
	expiry := testNow().Add(testLifetime)
	accepted := signer.sign(t, channelID, 2, amounts{host: 1_000, fee: 200, service: 10}, expiry)
	tests := map[string]struct {
		channel  func() apiclient.MachineVoucherChannel
		domain   func() apiclient.EscrowDomain
		previous *apiclient.MachineSignedVoucher
	}{
		"another signer than reported": {channel: func() apiclient.MachineVoucherChannel {
			signed := signer.sign(t, channelID, 3, amounts{host: 2_000, fee: 400, service: 10}, expiry)
			signed.Signer = newSigner(t).address().Hex()
			return listedChannel(t, signed)
		}},
		"tampered amount": {channel: func() apiclient.MachineVoucherChannel {
			signed := signer.sign(t, channelID, 3, amounts{host: 2_000, fee: 400, service: 10}, expiry)
			signed.HostAmount = "9000"
			return listedChannel(t, signed)
		}},
		"voucher for another channel": {channel: func() apiclient.MachineVoucherChannel {
			return listedChannel(t, signer.sign(t, testChannelID(t, uuid.NewString()), 3, amounts{host: 2_000}, expiry))
		}},
		"channel of another lease": {channel: func() apiclient.MachineVoucherChannel {
			otherLease := uuid.New()
			signed := signer.sign(t, channelID, 3, amounts{host: 2_000}, expiry)
			listed := listedChannel(t, signed)
			listed.LeaseId = otherLease
			return listed
		}},
		"expired": {channel: func() apiclient.MachineVoucherChannel {
			return listedChannel(t, signer.sign(t, channelID, 3, amounts{host: 2_000, fee: 400, service: 10}, testNow()))
		}},
		"older sequence": {previous: accepted, channel: func() apiclient.MachineVoucherChannel {
			return listedChannel(t, signer.sign(t, channelID, 1, amounts{host: 2_000, fee: 400, service: 10}, expiry))
		}},
		"same sequence, other signature": {previous: accepted, channel: func() apiclient.MachineVoucherChannel {
			return listedChannel(t, signer.sign(t, channelID, 2, amounts{host: 2_000, fee: 400, service: 10}, expiry))
		}},
		"host amount shrinks": {previous: accepted, channel: func() apiclient.MachineVoucherChannel {
			return listedChannel(t, signer.sign(t, channelID, 3, amounts{host: 999, fee: 400, service: 10}, expiry))
		}},
		"fee amount shrinks": {previous: accepted, channel: func() apiclient.MachineVoucherChannel {
			return listedChannel(t, signer.sign(t, channelID, 3, amounts{host: 2_000, fee: 199, service: 10}, expiry))
		}},
		"service amount shrinks": {previous: accepted, channel: func() apiclient.MachineVoucherChannel {
			return listedChannel(t, signer.sign(t, channelID, 3, amounts{host: 2_000, fee: 400, service: 9}, expiry))
		}},
		"unknown domain": {
			channel: func() apiclient.MachineVoucherChannel {
				return listedChannel(t, signer.sign(t, channelID, 3, amounts{host: 2_000}, expiry))
			},
			domain: func() apiclient.EscrowDomain {
				domain := testDomain()
				domain.Name = "OtherEscrow"
				return domain
			},
		},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			domain := testDomain()
			if test.domain != nil {
				domain = test.domain()
			}
			err := verify(test.channel(), domain, test.previous, testNow())
			if err == nil || errors.Is(err, errUnchanged) {
				t.Fatalf("verify() = %v, want a rejection", err)
			}
		})
	}
}

func TestVerifyAcceptsProgressAndRecognizesTheAcceptedVoucher(t *testing.T) {
	signer := newSigner(t)
	channelID := testChannelID(t, testLeaseID)
	expiry := testNow().Add(testLifetime)
	first := signer.sign(t, channelID, 1, amounts{host: 1_000, fee: 200}, expiry)
	if err := verify(listedChannel(t, first), testDomain(), nil, testNow()); err != nil {
		t.Fatalf("first voucher: %v", err)
	}
	next := signer.sign(t, channelID, 2, amounts{host: 1_000, fee: 200, service: 5}, expiry)
	if err := verify(listedChannel(t, next), testDomain(), first, testNow()); err != nil {
		t.Fatalf("next voucher: %v", err)
	}
	if err := verify(listedChannel(t, next), testDomain(), next, testNow()); !errors.Is(err, errUnchanged) {
		t.Fatalf("the accepted voucher again = %v, want errUnchanged", err)
	}
}

func TestProgressPinsTheHostAndCustomer(t *testing.T) {
	signer := newSigner(t)
	channelID := testChannelID(t, testLeaseID)
	expiry := testNow().Add(testLifetime)
	accepted, err := decodeSigned(*signer.sign(t, channelID, 1, amounts{host: 1}, expiry))
	if err != nil {
		t.Fatal(err)
	}
	for name, change := range map[string]func(*signedVoucher){
		"host":     func(received *signedVoucher) { received.voucher.Host = common.HexToAddress(testContract) },
		"customer": func(received *signedVoucher) { received.voucher.Customer = common.HexToAddress(testContract) },
	} {
		received, err := decodeSigned(*signer.sign(t, channelID, 2, amounts{host: 2}, expiry))
		if err != nil {
			t.Fatal(err)
		}
		change(&received)
		if err := verifyProgress(accepted, received); err == nil {
			t.Errorf("a changed %s was accepted", name)
		}
	}
}
