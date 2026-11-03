// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package microvm

import (
	"context"
	"errors"
	"fmt"

	"github.com/snapflowio/microvm-go/types"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func (runtime *Runtime) Recover(
	ctx context.Context,
	assignment sandboxruntime.Assignment,
	recovery *machinev1alpha1.SandboxRecovery,
	spec *machinev1alpha1.SandboxSpec,
) error {
	errorReason, backupErrorReason := recovery.GetErrorReason(), recovery.GetBackupErrorReason()
	if !workload.IsRecoverable(errorReason) && !workload.IsRecoverable(backupErrorReason) {
		return fmt.Errorf(
			"unable to deduce recovery type from error reason %q or backup error reason %q",
			errorReason,
			backupErrorReason,
		)
	}
	info, err := runtime.engine.RuntimeInfo(ctx, assignment.SandboxID)
	if err != nil {
		return fmt.Errorf("inspect sandbox before recovery: %w", err)
	}
	targetStorage, err := recoveredStorage(info.StorageGiB, int64(spec.GetResources().GetStorageQuota()))
	if err != nil {
		return err
	}
	if info.State != types.RuntimeStateStopped {
		if err := runtime.Stop(ctx, assignment, true); err != nil {
			return fmt.Errorf("stop sandbox for storage recovery: %w", err)
		}
	}
	if err := runtime.engine.Resize(ctx, assignment.SandboxID, types.ResizeRequest{
		Storage:              &targetStorage,
		AssignmentGeneration: int(assignment.Generation),
	}); err != nil {
		return fmt.Errorf("expand sandbox storage for recovery: %w", err)
	}
	if err := runtime.engine.UpdateNetworkSettings(ctx, assignment.SandboxID, toMicroVMNetworkSettings(spec.GetNetwork())); err != nil {
		return fmt.Errorf("reapply sandbox network policy for recovery: %w", err)
	}
	return nil
}

func recoveredStorage(currentStorage, storageQuota int64) (int64, error) {
	if currentStorage <= 0 {
		currentStorage = storageQuota
	}
	targetStorage := currentStorage + percentageCeiling(storageQuota, storageRecoveryIncrement)
	if targetStorage > storageQuota+percentageCeiling(storageQuota, storageRecoveryMaximum) {
		return 0, errors.New("storage cannot be further expanded")
	}
	return targetStorage, nil
}

func percentageCeiling(value, percentage int64) int64 {
	return (value*percentage + percentageBase - 1) / percentageBase
}
