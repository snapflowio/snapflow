// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"time"

	"github.com/snapflowio/snapflow/internal/workload"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	executionResultSchemaVersion = 1
)

func jobErrorCodes() map[machinev1alpha1.MachineErrorCode]apiclient.JobErrorCode {
	return map[machinev1alpha1.MachineErrorCode]apiclient.JobErrorCode{
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_UNSPECIFIED:                       apiclient.JobErrorCodeUnspecified,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_NONE:                              apiclient.JobErrorCodeNone,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INVALID_REQUEST:                   apiclient.JobErrorCodeInvalidRequest,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_STALE_ASSIGNMENT:                  apiclient.JobErrorCodeStaleAssignment,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_NOT_FOUND:                         apiclient.JobErrorCodeNotFound,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_IMAGE_INVALID:                     apiclient.JobErrorCodeImageInvalid,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_IMAGE_UNAVAILABLE:                 apiclient.JobErrorCodeImageUnavailable,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_SNAPSHOT_CORRUPT:                  apiclient.JobErrorCodeSnapshotCorrupt,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_BUNDLE_FETCH_FAILED:      apiclient.JobErrorCodePlatformBundleFetchFailed,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_BUNDLE_MOUNT_FAILED:      apiclient.JobErrorCodePlatformBundleMountFailed,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_COMPONENT_NOT_FOUND:      apiclient.JobErrorCodePlatformComponentNotFound,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_PLATFORM_COMPONENT_NOT_EXECUTABLE: apiclient.JobErrorCodePlatformComponentNotExecutable,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_GUEST_AUTHENTICATION_FAILED:       apiclient.JobErrorCodeGuestAuthenticationFailed,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_RUNTIME_UNAVAILABLE:               apiclient.JobErrorCodeRuntimeUnavailable,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_GUEST_NOT_READY:                   apiclient.JobErrorCodeGuestNotReady,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_HOST_IO_FAILED:                    apiclient.JobErrorCodeHostIoFailed,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_RUNTIME_MISSING:                   apiclient.JobErrorCodeRuntimeMissing,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_INSUFFICIENT_CAPACITY:             apiclient.JobErrorCodeInsufficientCapacity,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_CANCELLED:                         apiclient.JobErrorCodeCancelled,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_DEADLINE_EXCEEDED:                 apiclient.JobErrorCodeDeadlineExceeded,
		machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_UNKNOWN:                           apiclient.JobErrorCodeUnknown,
	}
}

func jobErrorCode(code machinev1alpha1.MachineErrorCode) apiclient.JobErrorCode {
	if mapped, ok := jobErrorCodes()[code]; ok {
		return mapped
	}
	return apiclient.JobErrorCodeUnknown
}

func executionResult(
	err error,
	duration time.Duration,
	runtimeIdentity string,
	releaseIdentity string,
) apiclient.JobExecutionResultDto {
	classification := workload.Classify(err)
	diagnostic := classification.Code.String()
	outcome := apiclient.JobExecutionResultDtoOutcomeFailed
	if err == nil {
		outcome = apiclient.JobExecutionResultDtoOutcomeSucceeded
	}
	timings := map[string]any{
		workload.TimingTotal: workload.DurationMilliseconds(duration),
	}
	return apiclient.JobExecutionResultDto{
		SchemaVersion:   executionResultSchemaVersion,
		Outcome:         outcome,
		Phase:           apiclient.JobExecutionResultDtoPhase(classification.Phase),
		ErrorCode:       jobErrorCode(classification.Code),
		Retryable:       classification.Retryable,
		RuntimeIdentity: runtimeIdentity,
		ReleaseIdentity: releaseIdentity,
		TimingsMs:       &timings,
		Diagnostic:      &diagnostic,
	}
}
