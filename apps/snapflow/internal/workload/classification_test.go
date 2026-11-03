// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"context"
	"errors"
	"fmt"
	"testing"

	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

type codedError string

func (code codedError) Error() string     { return "coded failure " + string(code) }
func (code codedError) ErrorCode() string { return string(code) }

func TestClassifyMapsEveryInternalCode(t *testing.T) {
	tests := []struct {
		code      string
		want      machinev1alpha1.MachineErrorCode
		phase     string
		retryable bool
	}{
		{InvalidRequestErrorCode, machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INVALID_REQUEST, PhaseAdmission, false},
		{sandboxruntime.StaleAssignmentErrorCode, machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_STALE_ASSIGNMENT, PhaseAdmission, false},
		{"NOT_FOUND", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_NOT_FOUND, PhaseWorkload, false},
		{"PLATFORM_BUNDLE_FETCH_FAILED", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_BUNDLE_FETCH_FAILED, PhaseImage, true},
		{"PLATFORM_BUNDLE_MOUNT_FAILED", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_BUNDLE_MOUNT_FAILED, PhaseGuestService, true},
		{"PLATFORM_COMPONENT_NOT_FOUND", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_COMPONENT_NOT_FOUND, PhaseGuestService, false},
		{"PLATFORM_COMPONENT_NOT_EXECUTABLE", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_COMPONENT_NOT_EXECUTABLE, PhaseGuestService, false},
		{"MICROVM_GUEST_SERVICE_CREDENTIAL_UNAVAILABLE", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_GUEST_AUTHENTICATION_FAILED, PhaseGuestService, false},
		{"MICROVM_INSUFFICIENT_cpu", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY, PhaseAdmission, true},
		{"MICROVM_INSUFFICIENT_memory", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY, PhaseAdmission, true},
		{"MICROVM_INSUFFICIENT_disk", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY, PhaseAdmission, true},
		{"MICROVM_INSUFFICIENT_gpu", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY, PhaseAdmission, true},
		{"MICROVM_INSUFFICIENT_network", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY, PhaseAdmission, true},
		{"MICROVM_RESOURCE_SHAPE_EXCEEDS_CAPACITY", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY, PhaseAdmission, false},
		{"MICROVM_RESTORE_MEMORY_BACKEND_UNAVAILABLE", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_RUNTIME_UNAVAILABLE, PhaseStorage, true},
		{"MICROVM_RESTORE_EXTERNAL_RESOURCE_BUSY", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_RUNTIME_UNAVAILABLE, PhaseStorage, true},
		{"MICROVM_RESTORE_SNAPSHOT_INCOMPATIBLE", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_IMAGE_INVALID, PhaseImage, false},
		{"MICROVM_RESTORE_SNAPSHOT_CORRUPT", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_SNAPSHOT_CORRUPT, PhaseStorage, true},
		{"MICROVM_RESTORE_PROCESS_CLEANUP_INCOMPLETE", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_HOST_IO_FAILED, PhaseStorage, true},
		{"MICROVM_RESTORE_GUEST_NOT_READY", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_GUEST_NOT_READY, PhaseGuestReadiness, true},
		{"MICROVM_RESTORE_FAILED", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_UNKNOWN, PhaseUnknown, true},
		{ErrorCodeRuntimeMissing, machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_RUNTIME_MISSING, PhaseWorkload, false},
		{ErrorCodeSnapshotUnavailable, machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_IMAGE_UNAVAILABLE, PhaseImage, true},
		{ErrorCodeSnapshotDigestMismatch, machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_SNAPSHOT_CORRUPT, PhaseStorage, true},
		{"MICROVM_SOMETHING_NEW", machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_UNKNOWN, PhaseUnknown, false},
	}
	for _, test := range tests {
		t.Run(test.code, func(t *testing.T) {
			want := Classification{Code: test.want, Phase: test.phase, Retryable: test.retryable}
			if got := Classify(fmt.Errorf("wrapped: %w", codedError(test.code))); got != want {
				t.Fatalf("Classify(%s) = %+v, want %+v", test.code, got, want)
			}
		})
	}
}

func TestClassifyWithoutAnInternalCode(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want Classification
	}{
		{"success", nil, Succeeded()},
		{"cancelled()", fmt.Errorf("converge: %w", context.Canceled), Classification{
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_CANCELLED, Phase: PhaseUnknown, Retryable: true,
		}},
		{"deadline", fmt.Errorf("converge: %w", context.DeadlineExceeded), Classification{
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_DEADLINE_EXCEEDED, Phase: PhaseUnknown, Retryable: true,
		}},
		{"uncoded", errors.New("unexpected failure"), Classification{
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_UNKNOWN, Phase: PhaseUnknown,
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := Classify(test.err); got != test.want {
				t.Fatalf("Classify(%v) = %+v, want %+v", test.err, got, test.want)
			}
		})
	}
}

func TestClassifyKeepsTheClassificationOfAConvergenceFailure(t *testing.T) {
	failure := ConvergenceFailure{
		Result: &machinev1alpha1.ConvergenceResult{
			ErrorCode: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY,
			Phase:     PhaseAdmission,
			Retryable: true,
		},
		Reason: "insufficient disk capacity",
	}
	want := Classification{
		Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY, Phase: PhaseAdmission, Retryable: true,
	}
	if got := Classify(fmt.Errorf("converge canary microVM: %w", failure)); got != want {
		t.Fatalf("Classify() = %+v, want %+v", got, want)
	}
}

func TestClassifyTreatsAConvergenceFailureWithoutAResultAsUnknown(t *testing.T) {
	want := Classification{Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_UNKNOWN, Phase: PhaseUnknown}
	if got := Classify(ConvergenceFailure{Reason: "no result"}); got != want {
		t.Fatalf("Classify() = %+v, want %+v", got, want)
	}
}
