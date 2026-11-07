// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"testing"
	"time"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	testChannelID      = "0x706f247b800ddcfc035df6460f09a2d3a7b2f718ef245fe540e82e2277a23255"
	otherChannelID     = "0x5499dfc6fd0fe5ef575156ab705bac237c895ddcc21d8f7ae60010b916067caf"
	testPaymentLeaseID = "0b5f3c2e-9d4a-4e1b-8c7f-2a6d9e0f1b3c"
	testHoldWindow     = 90 * time.Second
)

func testPaymentChannel(channelID string) PaymentChannel {
	return PaymentChannel{
		ChannelID: channelID, SandboxID: testSandboxID, LeaseID: testPaymentLeaseID,
		State: apiclient.PaymentChannelStateOpen, HoldWindow: testHoldWindow,
		Voucher:    &apiclient.MachineSignedVoucher{ChannelId: channelID, Sequence: "3", Signature: "0x01"},
		Domain:     &apiclient.EscrowDomain{ChainId: 84532, Name: "SnapflowEscrow", Version: "1"},
		AcceptedAt: testAcceptedAt(),
	}
}

func TestPaymentChannelsKeepHoldsAndForgetUnlistedChannels(t *testing.T) {
	database := openTestDatabase(t)
	first, second := testPaymentChannel(testChannelID), testPaymentChannel(otherChannelID)
	if err := database.ReplacePaymentChannels(t.Context(), []PaymentChannel{first, second}); err != nil {
		t.Fatalf("store channels: %v", err)
	}
	heldAt := testAcceptedAt().Add(time.Minute)
	if err := database.SetPaymentHold(t.Context(), testSandboxID, heldAt); err != nil {
		t.Fatalf("hold sandbox: %v", err)
	}
	first.Voucher.Sequence = "4"
	if err := database.ReplacePaymentChannels(t.Context(), []PaymentChannel{first}); err != nil {
		t.Fatalf("replace channels: %v", err)
	}
	loaded, err := database.LoadPaymentChannels(t.Context())
	if err != nil || len(loaded) != 1 {
		t.Fatalf("loaded channels = %v, %v", loaded, err)
	}
	got := loaded[0]
	if got.ChannelID != testChannelID || got.Voucher.Sequence != "4" || got.Domain.ChainId != 84532 ||
		!got.AcceptedAt.Equal(testAcceptedAt()) || !got.HeldAt.Equal(heldAt) || got.HoldWindow != testHoldWindow {
		t.Fatalf("loaded channel = %+v", got)
	}
	if err := database.SetPaymentHold(t.Context(), testSandboxID, time.Time{}); err != nil {
		t.Fatalf("release sandbox: %v", err)
	}
	if loaded, err := database.LoadPaymentChannels(t.Context()); err != nil || !loaded[0].HeldAt.IsZero() {
		t.Fatalf("released channel = %+v, %v", loaded, err)
	}
}

func TestPaymentChannelsRequireAVoucherWithItsDomain(t *testing.T) {
	database := openTestDatabase(t)
	channel := testPaymentChannel(testChannelID)
	channel.Domain = nil
	if err := database.ReplacePaymentChannels(t.Context(), []PaymentChannel{channel}); err == nil {
		t.Fatal("a voucher without its domain was stored")
	}
}
