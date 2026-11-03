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
	"strings"
	"syscall"
	"time"

	"github.com/snapflowio/microvm-go/guest"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	PhaseAdmission      = "admission"
	PhaseImage          = "image"
	PhaseStorage        = "storage"
	PhaseGuestReadiness = "guest_readiness"
	PhaseGuestService   = "guest_service"
	PhaseWorkload       = "workload"
	PhaseUnknown        = "unknown"
	TimingTotal         = "total"
)

const (
	ErrorCodeRuntimeMissing         = "RUNTIME_MISSING"
	ErrorCodeSnapshotUnavailable    = "SNAPSHOT_UNAVAILABLE"
	ErrorCodeSnapshotDigestMismatch = "SNAPSHOT_DIGEST_MISMATCH"
)

const insufficientCapacityCodePrefix = "MICROVM_INSUFFICIENT_"

type Classification struct {
	Code      machinev1alpha1.MachineErrorCode
	Phase     string
	Retryable bool
}

func Succeeded() Classification {
	return Classification{Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_NONE, Phase: PhaseWorkload}
}

func insufficientCapacity() Classification {
	return Classification{
		Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY, Phase: PhaseAdmission, Retryable: true,
	}
}

func hostStorageExhausted() Classification {
	return Classification{
		Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_HOST_IO_FAILED, Phase: PhaseStorage, Retryable: true,
	}
}

func guestStorageExhausted() Classification {
	return Classification{Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_GUEST_NOT_READY, Phase: PhaseWorkload}
}

func unclassified() Classification {
	return Classification{Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_UNKNOWN, Phase: PhaseUnknown}
}

func deadlineExceeded() Classification {
	return Classification{
		Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_DEADLINE_EXCEEDED, Phase: PhaseUnknown, Retryable: true,
	}
}

func cancelled() Classification {
	return Classification{
		Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_CANCELLED, Phase: PhaseUnknown, Retryable: true,
	}
}

type errorCoder interface {
	error
	ErrorCode() string
}

func codeClassifications() map[string]Classification {
	return map[string]Classification{
		InvalidRequestErrorCode: {Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INVALID_REQUEST, Phase: PhaseAdmission},
		sandboxruntime.StaleAssignmentErrorCode: {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_STALE_ASSIGNMENT, Phase: PhaseAdmission,
		},
		runtimeNotFoundCode: {Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_NOT_FOUND, Phase: PhaseWorkload},
		"PLATFORM_BUNDLE_FETCH_FAILED": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_BUNDLE_FETCH_FAILED, Phase: PhaseImage, Retryable: true,
		},
		"PLATFORM_BUNDLE_MOUNT_FAILED": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_BUNDLE_MOUNT_FAILED, Phase: PhaseGuestService, Retryable: true,
		},
		"PLATFORM_COMPONENT_NOT_FOUND": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_COMPONENT_NOT_FOUND, Phase: PhaseGuestService,
		},
		"PLATFORM_COMPONENT_NOT_EXECUTABLE": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_COMPONENT_NOT_EXECUTABLE, Phase: PhaseGuestService,
		},
		"MICROVM_GUEST_SERVICE_CREDENTIAL_UNAVAILABLE": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_GUEST_AUTHENTICATION_FAILED, Phase: PhaseGuestService,
		},
		"MICROVM_RESOURCE_SHAPE_EXCEEDS_CAPACITY": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY, Phase: PhaseAdmission,
		},
		"MICROVM_RESTORE_MEMORY_BACKEND_UNAVAILABLE": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_RUNTIME_UNAVAILABLE, Phase: PhaseStorage, Retryable: true,
		},
		"MICROVM_RESTORE_EXTERNAL_RESOURCE_BUSY": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_RUNTIME_UNAVAILABLE, Phase: PhaseStorage, Retryable: true,
		},
		"MICROVM_RESTORE_SNAPSHOT_INCOMPATIBLE": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_IMAGE_INVALID, Phase: PhaseImage,
		},
		"MICROVM_RESTORE_SNAPSHOT_CORRUPT": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_SNAPSHOT_CORRUPT, Phase: PhaseStorage, Retryable: true,
		},
		"MICROVM_RESTORE_PROCESS_CLEANUP_INCOMPLETE": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_HOST_IO_FAILED, Phase: PhaseStorage, Retryable: true,
		},
		"MICROVM_RESTORE_GUEST_NOT_READY": {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_GUEST_NOT_READY, Phase: PhaseGuestReadiness, Retryable: true,
		},
		"MICROVM_RESTORE_FAILED": {Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_UNKNOWN, Phase: PhaseUnknown, Retryable: true},
		ErrorCodeRuntimeMissing:  {Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_RUNTIME_MISSING, Phase: PhaseWorkload},
		ErrorCodeSnapshotUnavailable: {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_IMAGE_UNAVAILABLE, Phase: PhaseImage, Retryable: true,
		},
		ErrorCodeSnapshotDigestMismatch: {
			Code: machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_SNAPSHOT_CORRUPT, Phase: PhaseStorage, Retryable: true,
		},
	}
}

type ConvergenceFailure struct {
	Result *machinev1alpha1.ConvergenceResult
	Reason string
}

func (failure ConvergenceFailure) Error() string { return failure.Reason }

func (failure ConvergenceFailure) classification() Classification {
	return Classification{
		Code:      failure.Result.GetErrorCode(),
		Phase:     failure.Result.GetPhase(),
		Retryable: failure.Result.GetRetryable(),
	}
}

func Classify(err error) Classification {
	switch {
	case err == nil:
		return Succeeded()
	case errors.Is(err, context.Canceled):
		return cancelled()
	case errors.Is(err, context.DeadlineExceeded):
		return deadlineExceeded()
	}
	var failure ConvergenceFailure
	if errors.As(err, &failure) && failure.Result != nil {
		return failure.classification()
	}
	if errors.Is(err, syscall.ENOSPC) {
		return hostStorageExhausted()
	}
	var problem *guest.ControlProblem
	if errors.As(err, &problem) && IsRecoverable(problem.Message) {
		return guestStorageExhausted()
	}
	var coded errorCoder
	if !errors.As(err, &coded) {
		return unclassified()
	}
	return classifyCode(strings.TrimSpace(coded.ErrorCode()))
}

func classifyCode(code string) Classification {
	if classification, ok := codeClassifications()[code]; ok {
		return classification
	}
	if strings.HasPrefix(code, insufficientCapacityCodePrefix) {
		return insufficientCapacity()
	}
	return unclassified()
}

func DurationMilliseconds(duration time.Duration) float64 {
	return float64(duration.Microseconds()) / float64(time.Millisecond/time.Microsecond)
}
