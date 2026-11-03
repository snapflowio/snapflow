// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"fmt"
	"strings"
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	"github.com/snapflowio/snapflow/internal/state"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const (
	chunkedStatusCount = 250
	largeReasonLength  = 1800
	largeStatusCount   = 80
)

func numberedStatuses(count int, reason string) []*machinev1alpha1.SandboxObservedStatus {
	statuses := make([]*machinev1alpha1.SandboxObservedStatus, count)
	for index := range statuses {
		statuses[index] = &machinev1alpha1.SandboxObservedStatus{
			SandboxId: fmt.Sprintf("00000000-0000-4000-8000-%012d", index), AssignmentGeneration: 1,
			State:       machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_ERROR,
			ErrorReason: &reason, ObservedAt: timestamppb.Now(),
		}
	}
	return statuses
}

func TestChunkStatusesRespectsTheReportLimits(t *testing.T) {
	tests := map[string][]*machinev1alpha1.SandboxObservedStatus{
		"status count":  numberedStatuses(chunkedStatusCount, "failed"),
		"document size": numberedStatuses(largeStatusCount, strings.Repeat("x", largeReasonLength)),
	}
	for name, statuses := range tests {
		t.Run(name, func(t *testing.T) {
			reports, err := chunkStatuses(1, statuses)
			if err != nil {
				t.Fatalf("chunkStatuses() error = %v", err)
			}
			total := 0
			for _, report := range reports {
				encoded, err := protojson.Marshal(report)
				if err != nil {
					t.Fatalf("encode report: %v", err)
				}
				if len(report.GetStatuses()) > maximumStatusesPerReport || len(encoded) > maximumReportBytes {
					t.Fatalf("report of %d statuses and %d bytes exceeds the limits", len(report.GetStatuses()), len(encoded))
				}
				total += len(report.GetStatuses())
			}
			if total != len(statuses) || len(reports) < 2 {
				t.Fatalf("%d statuses were split into %d reports", total, len(reports))
			}
		})
	}
}

func TestReportSuppressesRejectedSandboxesAndLogsInvalidOnes(t *testing.T) {
	runtime := newFakeRuntime()
	runtime.host(testSandboxID, 1, microvmtypes.RuntimeStateStarted)
	runtime.host(otherSandboxID, 1, microvmtypes.RuntimeStateStopped)
	control := &fakeControl{verdicts: map[string]machinev1alpha1.SandboxObservedStatusVerdict{
		otherSandboxID: machinev1alpha1.SandboxObservedStatusVerdict_SANDBOX_OBSERVED_STATUS_VERDICT_STALE,
	}}
	service := testManager(t, runtime, control, newMemoryRecords())
	document := &machinev1alpha1.MachineDesiredState{
		Revision: 3, Sandboxes: []*machinev1alpha1.SandboxDesiredState{desiredSandbox(t, testSandboxID, 1, 1, started)},
	}
	service.current.Store(document)
	if err := service.reporter.report(t.Context()); err != nil {
		t.Fatalf("report() error = %v", err)
	}
	report := control.latestReport()
	if report.GetDesiredStateRevision() != document.GetRevision() || len(report.GetStatuses()) != 2 {
		t.Fatalf("report = %v", report)
	}
	if !service.activity.isSuppressed(otherSandboxID, document.GetRevision()) {
		t.Fatal("a STALE verdict did not suppress the sandbox")
	}
	if service.activity.isSuppressed(testSandboxID, document.GetRevision()) {
		t.Fatal("an ACCEPTED sandbox was suppressed")
	}
}

func TestObservedStatusDecisionTable(t *testing.T) {
	failed := "no space left on device"
	tests := map[string]struct {
		view  sandboxView
		state machinev1alpha1.SandboxRuntimeState
	}{
		"creating": {
			view:  sandboxView{desired: desiredSandbox(t, testSandboxID, 1, 1, started), record: &state.SandboxConvergence{AssignmentGeneration: 1}, converging: true},
			state: machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_CREATING,
		},
		"failed convergence": {
			view:  sandboxView{record: &state.SandboxConvergence{AssignmentGeneration: 1, FailureReason: failed}, runtime: hostedRuntime(microvmtypes.RuntimeStateStarted)},
			state: machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_ERROR,
		},
		"exited on its own": {
			view:  sandboxView{record: &state.SandboxConvergence{AssignmentGeneration: 1, ObservedSpecGeneration: 1}, runtime: hostedRuntime(microvmtypes.RuntimeStateStopped)},
			state: machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_STOPPED,
		},
		"standby is paused": {
			view:  sandboxView{runtime: hostedRuntime(microvmtypes.RuntimeStateStandby)},
			state: machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_PAUSED,
		},
		"lost after materialization": {
			view:  sandboxView{desired: desiredSandbox(t, testSandboxID, 1, 1, started), record: &state.SandboxConvergence{AssignmentGeneration: 1, Materialized: true}},
			state: machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_MISSING,
		},
		"destroyed": {
			view:  sandboxView{desired: desiredSandbox(t, testSandboxID, 1, 2, destroyed), record: &state.SandboxConvergence{AssignmentGeneration: 1, Materialized: true, ObservedSpecGeneration: 2}},
			state: machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_DESTROYED,
		},
		"transition in progress": {
			view:  sandboxView{runtime: hostedRuntime(microvmtypes.RuntimeStateStopping)},
			state: machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_UNSPECIFIED,
		},
		"never converged": {
			view:  sandboxView{desired: desiredSandbox(t, testSandboxID, 1, 1, started)},
			state: machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_UNSPECIFIED,
		},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			test.view.sandboxID = testSandboxID
			status, reportable := observedStatus(test.view, time.Now())
			if test.state == machinev1alpha1.SandboxRuntimeState_SANDBOX_RUNTIME_STATE_UNSPECIFIED {
				if reportable {
					t.Fatalf("status = %v, want nothing reported", status)
				}
				return
			}
			if !reportable || status.GetState() != test.state {
				t.Fatalf("status = %v, want %s", status, test.state)
			}
		})
	}
}

func hostedRuntime(current microvmtypes.RuntimeState) *microvmtypes.RuntimeObservation {
	return &microvmtypes.RuntimeObservation{
		ID: testSandboxID, Identity: microvmtypes.RuntimeArtifactIdentity{AssignmentGeneration: 1},
		Info: microvmtypes.RuntimeInfo{State: current}, ControlPlaneManaged: true, InspectionComplete: true,
	}
}
