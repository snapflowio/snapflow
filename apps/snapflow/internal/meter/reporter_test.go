// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"errors"
	"net/http"
	"reflect"
	"slices"
	"strconv"
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	testAPIURL              = "https://api.snapflow.test/api"
	testMachineID           = "machine-1"
	testOwnerID             = "owner-1"
	testPlacementID         = "11111111-1111-4111-8111-111111111111"
	testUsageSandboxID      = "sandbox-1"
	testFencingToken        = "22222222-2222-4222-8222-222222222222"
	testGeneration          = 2
	testCPU                 = 2
	testRunningStep         = 650
	runtimeNotFound         = "NOT_FOUND"
	firstSequence           = 1
	finalSequence           = 2
	testRuntimeGenerationID = "33333333-3333-4333-8333-333333333333"
)

func testAssignment() sandboxruntime.Assignment {
	return sandboxruntime.Assignment{SandboxID: testUsageSandboxID, Generation: testGeneration}
}

func TestReportSubmitsSignedReceipt(t *testing.T) {
	control := &fakeUsageAPI{placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)}}
	store := &memoryReadings{}
	reporter := newTestReporter(t, testUsageIdentity(t), &fakeSampler{}, control, store)
	if !reporter.report(t.Context(), true) {
		t.Fatal("report() left readings pending")
	}
	if len(control.receipts) != 1 || store.pending() != 0 {
		t.Fatalf("submitted %d receipts with %d pending, want 1 and none", len(control.receipts), store.pending())
	}
	receipt := control.receipts[0]
	if receipt.PlacementId.String() != testPlacementID || receipt.AssignmentGeneration != testGeneration ||
		receipt.Cpu != testCPU || receipt.RunningMillis != strconv.Itoa(testRunningStep) || receipt.Signature == pendingSignature || receipt.Signature == "" {
		t.Fatalf("submitted receipt = %+v", receipt)
	}
}

func TestReportSkipsFailedSamples(t *testing.T) {
	control := &fakeUsageAPI{placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)}}
	sampler := &fakeSampler{err: errors.New("runtime unavailable")}
	store := &memoryReadings{}
	newTestReporter(t, testUsageIdentity(t), sampler, control, store).report(t.Context(), true)
	if len(control.attempts) != 0 || store.pending() != 0 {
		t.Fatalf("submitted %d receipts for a failed sample", len(control.attempts))
	}
}

func TestFlushReportsTheFinalReadingOfADestroyedRuntime(t *testing.T) {
	control := &fakeUsageAPI{placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)}}
	sampler := &fakeSampler{}
	store := &memoryReadings{}
	reporter := newTestReporter(t, testUsageIdentity(t), sampler, control, store)
	reporter.report(t.Context(), true)
	reporter.Flush(t.Context(), testAssignment())
	sampler.fail(runtimeGone{})
	control.list(testPlacement(true))
	if !reporter.report(t.Context(), true) {
		t.Fatal("the final reading was not delivered")
	}
	if len(control.receipts) != 2 || store.pending() != 0 {
		t.Fatalf("submitted %d receipts with %d pending, want the periodic and the final reading", len(control.receipts), store.pending())
	}
	final := control.receipts[1]
	if final.Sequence != strconv.Itoa(finalSequence) || final.RunningMillis != strconv.Itoa(finalSequence*testRunningStep) || !final.SampledAt.After(control.receipts[0].SampledAt) {
		t.Fatalf("final receipt = %+v", final)
	}
	reporter.Flush(t.Context(), testAssignment())
	if store.pending() != 0 {
		t.Fatal("a runtime that is gone was read")
	}
}

func TestSampleTakesTheBaselineReadingOffTheCallerPath(t *testing.T) {
	control := &fakeUsageAPI{placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)}}
	store := &memoryReadings{}
	reporter := newTestReporter(t, testUsageIdentity(t), &fakeSampler{}, control, store)
	reporter.Sample(testAssignment())
	if store.pending() != 0 {
		t.Fatal("Sample read the runtime on the caller path")
	}
	select {
	case <-reporter.pending:
	default:
		t.Fatal("Sample did not wake the reporter")
	}
	reporter.readQueued(t.Context())
	if store.pending() != 1 {
		t.Fatalf("the queued baseline produced %d readings, want 1", store.pending())
	}
	reporter.readQueued(t.Context())
	if !reporter.report(t.Context(), false) || store.pending() != 0 || len(control.receipts) != 1 {
		t.Fatalf("delivered %d receipts with %d pending, want the baseline once", len(control.receipts), store.pending())
	}
}

func TestUndeliveredReadingsAreResentIdenticallyAfterARestart(t *testing.T) {
	control := &fakeUsageAPI{
		placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)},
		failures:   []error{controltest.StatusError(http.StatusServiceUnavailable)},
	}
	identity := testUsageIdentity(t)
	store := &memoryReadings{}
	sampler := &fakeSampler{}
	newTestReporter(t, identity, sampler, control, store).Flush(t.Context(), testAssignment())
	interrupted := newTestReporter(t, identity, sampler, control, store)
	if interrupted.report(t.Context(), false) || store.pending() != 1 {
		t.Fatalf("a failed delivery was settled; %d pending", store.pending())
	}
	restarted := newTestReporter(t, identity, sampler, control, store)
	if !restarted.report(t.Context(), false) || store.pending() != 0 {
		t.Fatalf("the restarted reporter did not resend the reading; %d pending", store.pending())
	}
	if len(control.attempts) != 2 || !reflect.DeepEqual(control.attempts[0], control.attempts[1]) {
		t.Fatalf("resent receipt differs from the first attempt: %+v", control.attempts)
	}
}

func TestPermanentRefusalDropsTheReading(t *testing.T) {
	control := &fakeUsageAPI{
		placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)},
		failures:   []error{controltest.StatusError(http.StatusBadRequest)},
	}
	store := &memoryReadings{}
	reporter := newTestReporter(t, testUsageIdentity(t), &fakeSampler{}, control, store)
	reporter.Flush(t.Context(), testAssignment())
	if !reporter.report(t.Context(), false) || store.pending() != 0 || len(control.receipts) != 0 {
		t.Fatalf("a refused reading was kept; %d pending", store.pending())
	}
}

func TestARejectedSessionKeepsTheReadingForTheNextSession(t *testing.T) {
	control := &fakeUsageAPI{
		placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)},
		failures:   []error{controltest.StatusError(http.StatusUnauthorized)},
	}
	store := &memoryReadings{}
	reporter := newTestReporter(t, testUsageIdentity(t), &fakeSampler{}, control, store)
	reporter.Flush(t.Context(), testAssignment())
	if reporter.report(t.Context(), false) || store.pending() != 1 {
		t.Fatalf("a reading the rejected session could not deliver was settled; %d pending", store.pending())
	}
	if !reporter.report(t.Context(), false) || store.pending() != 0 || len(control.receipts) != 1 {
		t.Fatalf("the kept reading was not delivered; %d pending", store.pending())
	}
}

func TestReadingsWaitForTheirPlacementAndAreDeliveredInSampleOrder(t *testing.T) {
	control := &fakeUsageAPI{}
	store := &memoryReadings{}
	reporter := newTestReporter(t, testUsageIdentity(t), &fakeSampler{}, control, store)
	reporter.Flush(t.Context(), testAssignment())
	reporter.Flush(t.Context(), testAssignment())
	slices.Reverse(store.readings)
	if reporter.report(t.Context(), false) || store.pending() != 2 {
		t.Fatalf("readings of an unlisted placement were settled; %d pending", store.pending())
	}
	control.list(testPlacement(false))
	if !reporter.report(t.Context(), false) || len(control.receipts) != 2 {
		t.Fatalf("submitted %d receipts once the placement was listed", len(control.receipts))
	}
	if control.receipts[0].Sequence != strconv.Itoa(firstSequence) || control.receipts[1].Sequence != strconv.Itoa(finalSequence) {
		t.Fatalf("receipts were not delivered in sample order: %s, %s", control.receipts[0].Sequence, control.receipts[1].Sequence)
	}
}

func TestReadingsAreDeliveredInSequenceOrderNotBySampleTimeOrSaveOrder(t *testing.T) {
	control := &fakeUsageAPI{placements: []apiclient.MachineReportablePlacementDto{testPlacement(false)}}
	store := &memoryReadings{}
	reporter := newTestReporter(t, testUsageIdentity(t), &fakeSampler{}, control, store)
	reporter.Flush(t.Context(), testAssignment())
	reporter.Flush(t.Context(), testAssignment())
	sampledAt := time.Now().Add(-time.Minute)
	store.readings[0].Sample.Sequence = finalSequence
	store.readings[0].Sample.SampledAt = sampledAt
	store.readings[1].Sample.Sequence = firstSequence
	store.readings[1].Sample.SampledAt = sampledAt.Add(time.Second)
	if !reporter.report(t.Context(), false) || len(control.receipts) != 2 {
		t.Fatalf("submitted %d receipts", len(control.receipts))
	}
	if control.receipts[0].Sequence != strconv.Itoa(firstSequence) || control.receipts[1].Sequence != strconv.Itoa(finalSequence) {
		t.Fatalf("receipts were not delivered in sequence order: %s, %s", control.receipts[0].Sequence, control.receipts[1].Sequence)
	}
}

func TestReadingsOfAPlacementNeverListedExpire(t *testing.T) {
	store := &memoryReadings{}
	reporter := newTestReporter(t, testUsageIdentity(t), &fakeSampler{}, &fakeUsageAPI{}, store)
	if err := store.SaveUsageReading(t.Context(), state.UsageReading{
		SandboxID: testUsageSandboxID, AssignmentGeneration: testGeneration,
		Sample: microvmtypes.RuntimeUsageSample{Sequence: 1, SampledAt: time.Now().Add(-maximumReadingAge - time.Minute)},
	}); err != nil {
		t.Fatalf("save reading: %v", err)
	}
	if !reporter.report(t.Context(), false) || store.pending() != 0 {
		t.Fatalf("an expired reading was kept; %d pending", store.pending())
	}
}
