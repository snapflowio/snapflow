// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package runtime

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/hypervisor/firecracker"
	"github.com/snapflowio/microvm-go/internal/state"
)

type restoreFailureKind string

const (
	restoreFailureMemoryBackendUnavailable restoreFailureKind = "memory_backend_unavailable"
	restoreFailureSnapshotIncompatible     restoreFailureKind = "snapshot_incompatible"
	restoreFailureSnapshotCorrupt          restoreFailureKind = "snapshot_corrupt"
	restoreFailureExternalResourceBusy     restoreFailureKind = "external_resource_busy"
	restoreFailureProcessCleanupIncomplete restoreFailureKind = "process_cleanup_incomplete"
	restoreFailureGuestReadiness           restoreFailureKind = "guest_readiness"
	restoreFailureUnknown                  restoreFailureKind = "unknown"
)

func restoreFailureCodes() map[restoreFailureKind]string {
	return map[restoreFailureKind]string{
		restoreFailureMemoryBackendUnavailable: "MICROVM_RESTORE_MEMORY_BACKEND_UNAVAILABLE",
		restoreFailureSnapshotIncompatible:     "MICROVM_RESTORE_SNAPSHOT_INCOMPATIBLE",
		restoreFailureSnapshotCorrupt:          "MICROVM_RESTORE_SNAPSHOT_CORRUPT",
		restoreFailureExternalResourceBusy:     "MICROVM_RESTORE_EXTERNAL_RESOURCE_BUSY",
		restoreFailureProcessCleanupIncomplete: "MICROVM_RESTORE_PROCESS_CLEANUP_INCOMPLETE",
		restoreFailureGuestReadiness:           "MICROVM_RESTORE_GUEST_NOT_READY",
		restoreFailureUnknown:                  "MICROVM_RESTORE_FAILED",
	}
}

type restoreFailure struct {
	kind  restoreFailureKind
	cause error
}

func (e *restoreFailure) Error() string {
	return fmt.Sprintf("microVM restore %s: %v", e.kind, e.cause)
}

func (e *restoreFailure) Unwrap() error { return e.cause }

func (e *restoreFailure) ErrorCode() string { return restoreFailureCodes()[e.kind] }

func (e *restoreFailure) HTTPStatusCode() int {
	switch e.kind {
	case restoreFailureMemoryBackendUnavailable, restoreFailureGuestReadiness:
		return http.StatusFailedDependency
	case restoreFailureSnapshotIncompatible, restoreFailureSnapshotCorrupt, restoreFailureExternalResourceBusy:
		return http.StatusConflict
	case restoreFailureProcessCleanupIncomplete, restoreFailureUnknown:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}

func newRestoreFailure(kind restoreFailureKind, cause error) error {
	if cause == nil {
		return nil
	}
	var existing *restoreFailure
	if errors.As(cause, &existing) {
		return cause
	}
	return &restoreFailure{kind: kind, cause: cause}
}

func classifyRestoreLaunchFailure(err error) restoreFailureKind {
	if err == nil {
		return restoreFailureUnknown
	}
	var apiErr *firecracker.APIError
	if !errors.As(err, &apiErr) {
		return restoreFailureUnknown
	}
	message := strings.ToLower(apiErr.FaultMessage)
	switch {
	case strings.Contains(message, "vsockunixbackend"),
		strings.Contains(message, "address in use"),
		strings.Contains(message, "resource busy"):
		return restoreFailureExternalResourceBusy
	case containsAny(message,
		"incompatible snapshot",
		"snapshot version",
		"cpu vendor",
		"cpu model",
		"cpu template",
		"gic version"):
		return restoreFailureSnapshotIncompatible
	case containsAny(message,
		"crc",
		"invalidavailidx",
		"invalid avail idx",
		"failed to deserialize",
		"invalid snapshot",
		"snapshot is corrupted",
		"snapshot is corrupt"):
		return restoreFailureSnapshotCorrupt
	case strings.Contains(message, "memory backend"):
		return restoreFailureMemoryBackendUnavailable
	default:
		return restoreFailureUnknown
	}
}

func containsAny(value string, candidates ...string) bool {
	for _, candidate := range candidates {
		if strings.Contains(value, candidate) {
			return true
		}
	}
	return false
}

func classifyPostResumeRestoreFailure(spec hypervisor.VM, process hypervisor.Process, cause error) error {
	if process.Running() {
		return newRestoreFailure(restoreFailureGuestReadiness, cause)
	}
	diagnostic := hypervisor.WithLogTail(cause, spec.VMMLogPath)
	message := strings.ToLower(diagnostic.Error())
	if containsAny(message, "invalidavailidx", "invalid avail idx") {
		return newRestoreFailure(restoreFailureSnapshotCorrupt, diagnostic)
	}
	return newRestoreFailure(restoreFailureUnknown, diagnostic)
}

func invalidateSnapshotAfterRestoreFailure(metadata *state.InstanceMetadata, cause error) {
	if metadata == nil {
		return
	}
	var failure *restoreFailure
	if !errors.As(cause, &failure) {
		return
	}
	if failure.kind != restoreFailureSnapshotCorrupt && failure.kind != restoreFailureSnapshotIncompatible {
		return
	}
	now := time.Now().UTC()
	metadata.SnapshotFailureCode = failure.ErrorCode()
	metadata.SnapshotInvalidatedAt = &now
}
