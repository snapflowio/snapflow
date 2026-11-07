// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"context"
	"crypto/ecdsa"
	"math/big"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/google/uuid"
	"github.com/snapflowio/contracts-go/escrow"
	"github.com/snapflowio/contracts-go/voucher"
	microvmtypes "github.com/snapflowio/microvm-go/types"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	testChainID       = 84532
	testContract      = "0x5aAdFB43eF8dAF45DD80F4676345b7676f1D70e3"
	testCustomer      = "0x000000000000000000000000000000000000c057"
	testHost          = "0x0000000000000000000000000000000000000057"
	testSandboxID     = "0b9d4f62-5d1c-4f0e-9a51-3c7e2f8b6a14"
	testLeaseID       = "0b5f3c2e-9d4a-4e1b-8c7f-2a6d9e0f1b3c"
	testInterval      = 30
	testGrace         = 3
	testWindow        = testInterval * testGrace * time.Second
	testLifetime      = 24 * time.Hour
	legacyRecoveryAdd = 27
	recoveryByte      = 64
)

func testNow() time.Time {
	return time.Date(2026, time.November, 5, 12, 0, 0, 0, time.UTC)
}

func testDomain() apiclient.EscrowDomain {
	return apiclient.EscrowDomain{
		ChainId: testChainID, Name: voucher.DomainName, Version: voucher.DomainVersion, VerifyingContract: testContract,
	}
}

type amounts struct {
	host, fee, service int64
}

// voucherSigner signs vouchers like a customer's session key or Snapflow's
// delegated signer would.
type voucherSigner struct {
	key *ecdsa.PrivateKey
}

func newSigner(t *testing.T) voucherSigner {
	t.Helper()
	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("generate signer key: %v", err)
	}
	return voucherSigner{key: key}
}

func (signer voucherSigner) address() common.Address {
	return crypto.PubkeyToAddress(signer.key.PublicKey)
}

func testChannelID(t *testing.T, leaseID string) common.Hash {
	t.Helper()
	channelID, err := voucher.ChannelID(common.HexToAddress(testCustomer), common.HexToAddress(testHost), leaseID)
	if err != nil {
		t.Fatalf("derive channel: %v", err)
	}
	return channelID
}

func (signer voucherSigner) sign(t *testing.T, channelID common.Hash, sequence uint64, paid amounts, expiry time.Time) *apiclient.MachineSignedVoucher {
	t.Helper()
	unsigned := escrow.Voucher{
		ChannelId: channelID, Customer: common.HexToAddress(testCustomer), Host: common.HexToAddress(testHost),
		HostAmount: big.NewInt(paid.host), FeeAmount: big.NewInt(paid.fee), ServiceAmount: big.NewInt(paid.service),
		Sequence: sequence, Expiry: uint64(expiry.Unix()),
	}
	escrowDomain, err := decodeDomain(testDomain())
	if err != nil {
		t.Fatalf("decode domain: %v", err)
	}
	digest, err := voucher.Digest(escrowDomain, unsigned)
	if err != nil {
		t.Fatalf("digest voucher: %v", err)
	}
	signature, err := crypto.Sign(digest.Bytes(), signer.key)
	if err != nil {
		t.Fatalf("sign voucher: %v", err)
	}
	signature[recoveryByte] += legacyRecoveryAdd
	return &apiclient.MachineSignedVoucher{
		ChannelId: channelID.Hex(), Customer: testCustomer, Host: testHost,
		HostAmount: strconv.FormatInt(paid.host, decimalBase), FeeAmount: strconv.FormatInt(paid.fee, decimalBase),
		ServiceAmount: strconv.FormatInt(paid.service, decimalBase),
		Sequence:      strconv.FormatUint(sequence, decimalBase), Expiry: strconv.FormatInt(expiry.Unix(), decimalBase),
		Signer: signer.address().Hex(), Signature: hexutil.Encode(signature),
	}
}

func listedChannel(t *testing.T, signed *apiclient.MachineSignedVoucher) apiclient.MachineVoucherChannel {
	t.Helper()
	return apiclient.MachineVoucherChannel{
		ChannelId: testChannelID(t, testLeaseID).Hex(), LeaseId: uuid.MustParse(testLeaseID),
		SandboxId: testSandboxID, State: apiclient.PaymentChannelStateOpen, Voucher: signed,
	}
}

func relay(digest string, channels ...apiclient.MachineVoucherChannel) *apiclient.MachineVoucherRelay {
	return &apiclient.MachineVoucherRelay{
		Digest: digest, Domain: testDomain(), Channels: channels,
		VoucherIntervalSeconds: testInterval, VoucherGraceIntervals: testGrace,
	}
}

type fakeSource struct {
	mu        sync.Mutex
	documents []*apiclient.MachineVoucherRelay
}

func (source *fakeSource) FetchVouchers(_ context.Context, digest string) (*apiclient.MachineVoucherRelay, bool, error) {
	source.mu.Lock()
	defer source.mu.Unlock()
	if len(source.documents) == 0 || source.documents[0].Digest == digest {
		return nil, false, nil
	}
	document := source.documents[0]
	source.documents = source.documents[1:]
	return document, true, nil
}

type fakeInventory struct {
	running map[string]bool
}

func (inventory *fakeInventory) RuntimeInventory(context.Context) ([]microvmtypes.RuntimeObservation, error) {
	observations := make([]microvmtypes.RuntimeObservation, 0, len(inventory.running))
	for sandboxID, running := range inventory.running {
		runtimeState := microvmtypes.RuntimeStatePaused
		if running {
			runtimeState = microvmtypes.RuntimeStateStarted
		}
		observations = append(observations, microvmtypes.RuntimeObservation{
			ID: sandboxID, ControlPlaneManaged: true, Info: microvmtypes.RuntimeInfo{State: runtimeState},
		})
	}
	return observations, nil
}

type recordedHolds struct {
	held map[string]bool
}

func (holds *recordedHolds) Set(sandboxID string, held bool) {
	holds.held[sandboxID] = held
}
