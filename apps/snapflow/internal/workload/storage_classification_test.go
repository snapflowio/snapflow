// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"errors"
	"fmt"
	"io/fs"
	"syscall"
	"testing"

	"github.com/snapflowio/microvm-go/guest"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const guestRestoreStepFailed = "GUEST_RESTORE_STEP_FAILED"

func hostDiskFull() error {
	return &fs.PathError{Op: "write", Path: "/var/lib/snapflow/instances/overlay.raw", Err: syscall.ENOSPC}
}

func TestClassifyAttributesAFullHostFilesystemToTheMachine(t *testing.T) {
	want := hostStorageExhausted()
	for name, err := range map[string]error{
		"wrapped":           fmt.Errorf("clone empty overlay disk: %w", hostDiskFull()),
		"behind a code":     errors.Join(codedError("MICROVM_RESTORE_FAILED"), hostDiskFull()),
		"recoverable":       FormatRecoverableError(fmt.Errorf("export snapshot: %w", hostDiskFull())),
		"host tool failure": fmt.Errorf("mkfs.ext4: %w", fmt.Errorf("exit status 1: %w", syscall.ENOSPC)),
	} {
		t.Run(name, func(t *testing.T) {
			got := Classify(err)
			if got != want || got.Code != machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_HOST_IO_FAILED {
				t.Fatalf("Classify(%v) = %+v, want %+v", err, got, want)
			}
		})
	}
}

func TestClassifyAttributesAFullGuestDiskToTheWorkload(t *testing.T) {
	problem := &guest.ControlProblem{Code: guestRestoreStepFailed, Message: "write /home/user/data: no space left on device"}
	got := Classify(fmt.Errorf("restore guest: %w", problem))
	if got != guestStorageExhausted() || got.Code == machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_UNKNOWN {
		t.Fatalf("Classify(guest disk full) = %+v, want %+v", got, guestStorageExhausted())
	}
}

func TestClassifyLeavesOtherGuestProblemsUnclassified(t *testing.T) {
	problem := &guest.ControlProblem{Code: guestRestoreStepFailed, Message: "mount /workspace: invalid argument"}
	if got := Classify(fmt.Errorf("restore guest: %w", problem)); got != unclassified() {
		t.Fatalf("Classify(guest problem) = %+v, want %+v", got, unclassified())
	}
}

func TestFormatRecoverableErrorKeepsTheCause(t *testing.T) {
	cause := hostDiskFull()
	formatted := FormatRecoverableError(cause)
	if !errors.Is(formatted, syscall.ENOSPC) || !IsRecoverable(formatted.Error()) {
		t.Fatalf("FormatRecoverableError() = %v, want a recoverable payload that keeps ENOSPC", formatted)
	}
}
