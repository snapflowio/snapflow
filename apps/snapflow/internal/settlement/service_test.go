// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package settlement

import (
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type clock struct {
	now time.Time
}

func (current *clock) read() time.Time { return current.now }

type harness struct {
	database  *state.Database
	source    *fakeSource
	inventory *fakeInventory
	holds     *recordedHolds
	clock     *clock
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	database, err := state.OpenDatabase(t.Context(), t.TempDir())
	if err != nil {
		t.Fatalf("open state: %v", err)
	}
	t.Cleanup(func() {
		if err := database.Close(t.Context()); err != nil {
			t.Errorf("close state: %v", err)
		}
	})
	return &harness{
		database: database, source: &fakeSource{}, inventory: &fakeInventory{running: running(testSandboxID)},
		holds: &recordedHolds{held: make(map[string]bool)}, clock: &clock{now: testNow()},
	}
}

func (h *harness) service(t *testing.T) *Service {
	t.Helper()
	service, err := New(
		Dependencies{Control: h.source, Store: h.database, Runtime: h.inventory, Holds: h.holds},
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))), WithClock(h.clock.read),
	)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if err := service.Restore(t.Context()); err != nil {
		t.Fatalf("Restore() error = %v", err)
	}
	return service
}

func (h *harness) publish(t *testing.T, service *Service, document *apiclient.MachineVoucherRelay) {
	t.Helper()
	h.source.documents = append(h.source.documents, document)
	if err := service.refresh(t.Context()); err != nil {
		t.Fatalf("refresh() error = %v", err)
	}
}

func (h *harness) stored(t *testing.T) state.PaymentChannel {
	t.Helper()
	channels, err := h.database.LoadPaymentChannels(t.Context())
	if err != nil || len(channels) != 1 {
		t.Fatalf("stored channels = %v (%v), want one", channels, err)
	}
	return channels[0]
}

func TestServiceKeepsTheLastVerifiedVoucherAcrossRejectionsAndRestarts(t *testing.T) {
	h := newHarness(t)
	signer := newSigner(t)
	channelID := testChannelID(t, testLeaseID)
	expiry := testNow().Add(testLifetime)
	service := h.service(t)

	first := signer.sign(t, channelID, 1, amounts{host: 1_000, fee: 200}, expiry)
	h.publish(t, service, relay("first", listedChannel(t, first)))
	if stored := h.stored(t); stored.Voucher == nil || stored.Voucher.Sequence != first.Sequence ||
		!stored.AcceptedAt.Equal(testNow()) || stored.HoldWindow != testWindow {
		t.Fatalf("stored channel = %+v", stored)
	}

	forged := signer.sign(t, channelID, 2, amounts{host: 5_000, fee: 200}, expiry)
	forged.Signer = newSigner(t).address().Hex()
	h.clock.now = h.clock.now.Add(time.Minute)
	h.publish(t, service, relay("forged", listedChannel(t, forged)))
	if stored := h.stored(t); stored.Voucher.Sequence != first.Sequence || !stored.AcceptedAt.Equal(testNow()) {
		t.Fatalf("a forged voucher replaced the accepted one: %+v", stored.Voucher)
	}

	restarted := h.service(t)
	second := signer.sign(t, channelID, 2, amounts{host: 2_000, fee: 400}, expiry)
	h.publish(t, restarted, relay("second", listedChannel(t, second)))
	if stored := h.stored(t); stored.Voucher.Sequence != second.Sequence {
		t.Fatalf("a restarted daemon did not accept the next voucher: %+v", stored.Voucher)
	}
}

func TestServiceHoldsAnUnpaidSandboxUntilItsCustomerPaysAgain(t *testing.T) {
	h := newHarness(t)
	signer := newSigner(t)
	channelID := testChannelID(t, testLeaseID)
	expiry := testNow().Add(testLifetime)
	service := h.service(t)
	h.publish(t, service, relay("first", listedChannel(t, signer.sign(t, channelID, 1, amounts{host: 1_000}, expiry))))

	service.enforce(t.Context())
	h.clock.now = testNow().Add(testWindow + time.Second)
	service.enforce(t.Context())
	if !h.holds.held[testSandboxID] || h.stored(t).HeldAt.IsZero() {
		t.Fatalf("the unpaid sandbox was not held and stored: holds %v", h.holds.held)
	}

	h.holds = &recordedHolds{held: make(map[string]bool)}
	h.inventory.running = map[string]bool{testSandboxID: false}
	restarted := h.service(t)
	if !h.holds.held[testSandboxID] {
		t.Fatal("a restart forgot the payment hold")
	}
	restarted.enforce(t.Context())
	if !h.holds.held[testSandboxID] {
		t.Fatal("the hold was released without a new voucher")
	}

	h.publish(t, restarted, relay("second", listedChannel(t, signer.sign(t, channelID, 2, amounts{host: 2_000}, expiry))))
	restarted.enforce(t.Context())
	if h.holds.held[testSandboxID] || !h.stored(t).HeldAt.IsZero() {
		t.Fatalf("a fresh voucher did not release the hold: holds %v", h.holds.held)
	}
}

func TestServiceRejectsADocumentWithoutAPaymentWindow(t *testing.T) {
	h := newHarness(t)
	service := h.service(t)
	document := relay("broken")
	document.VoucherGraceIntervals = 0
	h.source.documents = append(h.source.documents, document)
	if err := service.refresh(t.Context()); err == nil {
		t.Fatal("a document without a payment window was accepted")
	}
}
