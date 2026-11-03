// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	goldenPayload = "25:snapflow.machine-usage.v5" + "9:machine-1" + "36:11111111-1111-4111-8111-111111111111" + "9:sandbox-1" + "1:2" + "36:22222222-2222-4222-8222-222222222222" +
		"36:33333333-3333-4333-8333-333333333333" + "1:1" + "64:0000000000000000000000000000000000000000000000000000000000000000" +
		"24:2026-10-04T16:42:48.701Z" + "7:started" + "3:650" + "4:4096" + "4:8192" + "3:512" + "3:256" + "4:4700" + "4:8500" +
		"1:2" + "1:4" + "2:10" + "1:0"
	goldenDigest              = "8ac90a1877193a481c6c26b6b37e4d16f9033d02e339a9a51617d6c6306d2c70"
	goldenInternetEgressBytes = 4096
	goldenInternetIngress     = 8192
	goldenHostEgressBytes     = 512
	goldenHostIngressBytes    = 256
	goldenTapEgressBytes      = 4700
	goldenTapIngressBytes     = 8500
	goldenMemoryGiB           = 4
	goldenDiskGiB             = 10
	restartedRuntimeID        = "44444444-4444-4444-8444-444444444444"
	unreportableCPU           = -1
)

func goldenSampledAt() time.Time {
	return time.Date(2026, 10, 4, 16, 42, 48, 701_000_000, time.UTC)
}

func receiptDigest(receipt apiclient.MachineUsageReceiptDto) string {
	return payloadDigest(signaturePayload(testMachineID, &receipt))
}

func (control *fakeUsageAPI) lastAttempt() apiclient.MachineUsageReceiptDto {
	control.mu.Lock()
	defer control.mu.Unlock()
	return control.attempts[len(control.attempts)-1]
}

func TestTheSignaturePayloadFramesEveryFieldInOrder(t *testing.T) {
	sample := microvmtypes.RuntimeUsageSample{
		Sequence: firstSequence, SampledAt: goldenSampledAt(), GenerationID: testRuntimeGenerationID,
		State: string(apiclient.MachineUsageRuntimeStateStarted), RunningMillis: testRunningStep,
		InternetEgressBytes: goldenInternetEgressBytes, InternetIngressBytes: goldenInternetIngress,
		HostEgressBytes: goldenHostEgressBytes, HostIngressBytes: goldenHostIngressBytes,
		TapEgressBytes: goldenTapEgressBytes, TapIngressBytes: goldenTapIngressBytes,
		CPUVCPUs: testCPU, MemoryGiB: goldenMemoryGiB, StorageGiB: goldenDiskGiB,
	}
	signed, err := signReceipt(testUsageIdentity(t), testPlacement(false), sample, genesisDigest())
	if err != nil {
		t.Fatalf("signReceipt() error = %v", err)
	}
	if payload := signaturePayload(testMachineID, &signed.receipt); payload != goldenPayload {
		t.Fatalf("signature payload = %q, want %q", payload, goldenPayload)
	}
	if signed.digest != goldenDigest || signed.receipt.PreviousDigest != genesisDigest() || genesisDigest() != strings.Repeat("0", len(goldenDigest)) {
		t.Fatalf("signed digest = %s, previous digest = %s", signed.digest, signed.receipt.PreviousDigest)
	}
	if signed.chain != (state.UsageChainKey{PlacementID: testPlacementID, GenerationID: testRuntimeGenerationID}) {
		t.Fatalf("signed chain = %+v", signed.chain)
	}
}

func TestReadingsChainToTheLastAcceptedReadingOfTheirGeneration(t *testing.T) {
	control := &fakeUsageAPI{placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)}}
	sampler := &fakeSampler{}
	reporter := newTestReporter(t, testUsageIdentity(t), sampler, control, &memoryReadings{})
	deliver := func() {
		t.Helper()
		reporter.Flush(t.Context(), testAssignment())
		if !reporter.report(t.Context(), false) {
			t.Fatal("report() left readings pending")
		}
	}
	deliver()
	first := control.lastAttempt()
	if first.PreviousDigest != genesisDigest() {
		t.Fatalf("the first reading chains to %s, want the genesis digest", first.PreviousDigest)
	}
	deliver()
	accepted := control.lastAttempt()
	if accepted.PreviousDigest != receiptDigest(first) {
		t.Fatal("the second reading does not chain to the first")
	}
	control.failures = []error{controltest.StatusError(http.StatusBadRequest)}
	deliver()
	refused := control.lastAttempt()
	deliver()
	if next := control.lastAttempt(); next.PreviousDigest != receiptDigest(accepted) || next.PreviousDigest == receiptDigest(refused) {
		t.Fatal("the reading after a refused one does not chain to the last accepted reading")
	}
	sampler.restart(restartedRuntimeID)
	deliver()
	if restarted := control.lastAttempt(); restarted.PreviousDigest != genesisDigest() || restarted.GenerationId.String() != restartedRuntimeID {
		t.Fatalf("the first reading of a new generation chains to %s, want the genesis digest", restarted.PreviousDigest)
	}
}

func TestDroppedReadingsDoNotAdvanceTheChain(t *testing.T) {
	control := &fakeUsageAPI{placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)}}
	store := &memoryReadings{}
	reporter := newTestReporter(t, testUsageIdentity(t), &fakeSampler{}, control, store)
	reporter.Flush(t.Context(), testAssignment())
	if !reporter.report(t.Context(), false) {
		t.Fatal("the first reading was not delivered")
	}
	accepted := control.lastAttempt()
	reporter.Flush(t.Context(), testAssignment())
	store.readings[0].Sample.CPUVCPUs = unreportableCPU
	if !reporter.report(t.Context(), false) || store.pending() != 0 {
		t.Fatalf("the unreportable reading was kept; %d pending", store.pending())
	}
	control.list()
	reporter.Flush(t.Context(), testAssignment())
	store.readings[0].Sample.SampledAt = time.Now().Add(-maximumReadingAge - time.Minute)
	if !reporter.report(t.Context(), false) || store.pending() != 0 {
		t.Fatalf("the expired reading was kept; %d pending", store.pending())
	}
	control.list(testPlacement(false))
	reporter.Flush(t.Context(), testAssignment())
	if !reporter.report(t.Context(), false) {
		t.Fatal("the next reading was not delivered")
	}
	if next := control.lastAttempt(); next.PreviousDigest != receiptDigest(accepted) || len(control.receipts) != 2 {
		t.Fatalf("the next reading chains to %s, want the last accepted reading", next.PreviousDigest)
	}
}

func TestDeliveryPrunesStaleChainHeads(t *testing.T) {
	stale := state.UsageChainKey{PlacementID: testPlacementID, GenerationID: restartedRuntimeID}
	store := &memoryReadings{heads: map[state.UsageChainKey]state.UsageChainHead{
		stale: {Key: stale, Digest: goldenDigest, UpdatedAt: time.Now().Add(-usageChainRetention - time.Minute)},
	}}
	reporter := newTestReporter(t, testUsageIdentity(t), &fakeSampler{}, &fakeUsageAPI{}, store)
	if !reporter.report(t.Context(), false) {
		t.Fatal("report() left readings pending")
	}
	if digest, found, err := store.LoadUsageChainHead(t.Context(), stale); err != nil || found {
		t.Fatalf("stale head = %q, %v, %v; want it pruned", digest, found, err)
	}
}

func TestTheChainSurvivesAMachineRestart(t *testing.T) {
	stateDirectory := filepath.Join(t.TempDir(), "machine")
	control := &fakeUsageAPI{placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)}}
	identity := testUsageIdentity(t)
	sampler := &fakeSampler{}
	deliverOnce := func() {
		t.Helper()
		database, err := state.OpenDatabase(t.Context(), stateDirectory)
		if err != nil {
			t.Fatalf("open Machine database: %v", err)
		}
		reporter := newTestReporter(t, identity, sampler, control, database)
		reporter.Flush(t.Context(), testAssignment())
		delivered := reporter.report(t.Context(), false)
		if err := database.Close(t.Context()); err != nil {
			t.Fatalf("close Machine database: %v", err)
		}
		if !delivered {
			t.Fatal("report() left readings pending")
		}
	}
	deliverOnce()
	first := control.lastAttempt()
	deliverOnce()
	if next := control.lastAttempt(); first.PreviousDigest != genesisDigest() || next.PreviousDigest != receiptDigest(first) {
		t.Fatalf("after a restart the reading chains to %s, want the persisted head", next.PreviousDigest)
	}
}
