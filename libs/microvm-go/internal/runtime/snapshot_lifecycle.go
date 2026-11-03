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
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) Standby(ctx context.Context, instanceID string) error {
	defer b.requestSupportDiskSample()
	return runLifecycleAction(b, instanceID, lifecycle.OperationStandby, func() error {
		guard, err := b.lifecycle.Lock(ctx, instanceID)
		if err != nil {
			return fmt.Errorf("acquire instance lifecycle lock: %w", err)
		}
		defer guard.Release()
		return b.standbyLocked(ctx, instanceID)
	})
}

func (b *Backend) standbyLocked(ctx context.Context, instanceID string) error {
	metadata, err := b.readInstance(instanceID)
	if err != nil {
		return err
	}
	if err := validateRequestedTransition(lifecycle.OperationStandby, metadata.State); err != nil {
		return err
	}
	if metadata.State == types.RuntimeStateStandby {
		return nil
	}
	if err := b.validateStandbySource(ctx, metadata); err != nil {
		return err
	}
	reservationResources := activeInstanceResources(metadata)
	reservationResources.DiskGiB += metadata.MemoryQuota
	reservation, err := b.reserveResources(ctx, instanceID, reservationResources)
	if err != nil {
		return err
	}
	defer reservation.Finish()
	if err := b.pauseForStandby(ctx, &metadata); err != nil {
		return err
	}
	if err := b.snapshotAndStopForStandby(ctx, instanceID, &metadata); err != nil {
		return err
	}
	b.releaseStandbyNetwork(ctx, &metadata)
	now := time.Now().UTC()
	metadata.SnapshotFailureCode = ""
	metadata.SnapshotInvalidatedAt = nil
	metadata.PID = 0
	metadata.StoppedAt = &now
	return b.persistRuntimeState(&metadata, types.RuntimeStateStandby)
}

func (b *Backend) validateStandbySource(ctx context.Context, metadata state.InstanceMetadata) error {
	if err := validateMemorySnapshotPolicy(metadata); err != nil {
		return err
	}
	if metadata.GPUQuota > 0 {
		return stateConflict("standby snapshots are not supported for GPU instances", "MICROVM_GPU_STANDBY_UNSUPPORTED")
	}
	if metadata.State != types.RuntimeStateStarted || !b.processRunning(ctx, metadata) {
		return stateConflict("instance must be running before it can enter standby", "MICROVM_STANDBY_REQUIRES_RUNNING_STATE")
	}
	return nil
}

func (b *Backend) pauseForStandby(ctx context.Context, metadata *state.InstanceMetadata) error {
	if err := b.quiesceGuestForSnapshot(ctx, metadata); err != nil {
		return err
	}
	if err := b.pauseVM(ctx, *metadata); err != nil {
		resumeGuestErr := b.resumeGuestAfterSnapshot(context.WithoutCancel(ctx), *metadata)
		return errors.Join(err, wrapOptionalError("resume guest identity after pause failure", resumeGuestErr))
	}
	if err := b.persistSnapshotPause(metadata); err != nil {
		resumeVMErr := b.resumeVM(context.WithoutCancel(ctx), *metadata)
		resumeGuestErr := b.resumeGuestAfterSnapshot(context.WithoutCancel(ctx), *metadata)
		return errors.Join(
			err,
			wrapOptionalError("resume VM after standby pause persistence failure", resumeVMErr),
			wrapOptionalError("resume guest after standby pause persistence failure", resumeGuestErr),
		)
	}
	return nil
}

func (b *Backend) snapshotAndStopForStandby(ctx context.Context, instanceID string, metadata *state.InstanceMetadata) error {
	snapshotDir := b.paths.InstanceLatestSnapshot(instanceID)
	if err := os.RemoveAll(snapshotDir); err != nil {
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), metadata)
		return errors.Join(fmt.Errorf("clear previous standby snapshot: %w", err), wrapOptionalError("resume instance after snapshot cleanup failure", resumeErr))
	}
	if err := b.snapshotVM(ctx, *metadata, snapshotDir); err != nil {
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), metadata)
		return errors.Join(err, wrapOptionalError("resume instance after standby snapshot failure", resumeErr))
	}
	if err := b.stopVM(ctx, metadata); err != nil {
		resumeErr := b.resumeSnapshotSource(context.WithoutCancel(ctx), metadata)
		return errors.Join(
			err,
			wrapOptionalError("resume instance after standby stop failure", resumeErr),
		)
	}
	return nil
}

func (b *Backend) releaseStandbyNetwork(ctx context.Context, metadata *state.InstanceMetadata) {
	if !instanceHasNetwork(*metadata) {
		return
	}
	if err := b.releaseMeteredNetwork(ctx, metadata); err != nil {
		slog.WarnContext(ctx, "could not release standby network allocation", "instance_id", metadata.ID, "error", err)
		return
	}
	clearNetworkIdentity(metadata)
}

func validateMemorySnapshotPolicy(metadata state.InstanceMetadata) error {
	if !metadata.RequiresSecretEnv {
		return nil
	}
	return stateConflict(
		"live memory snapshots are unavailable for instances with managed secrets; stop the instance before creating a snapshot",
		"MICROVM_SECRET_MEMORY_SNAPSHOT_UNSUPPORTED",
	)
}

func (b *Backend) readInstance(instanceID string) (state.InstanceMetadata, error) {
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return state.InstanceMetadata{}, mvmerrors.NewNotFound(fmt.Errorf("instance %s", instanceID))
		}
		return state.InstanceMetadata{}, err
	}
	return metadata, nil
}

func stateConflict(message, code string) error {
	return mvmerrors.New(http.StatusConflict, message, code)
}
