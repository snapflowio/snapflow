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

	"github.com/snapflowio/microvm-go/hypervisor"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

type restoreAttempt struct {
	metadata              state.InstanceMetadata
	snapshotDir           string
	process               hypervisor.Process
	allocatedNetwork      bool
	initializationStarted bool
}

type restoreTimings struct {
	startedAt       time.Time
	networkReadyAt  time.Time
	specReadyAt     time.Time
	vmmRestoredAt   time.Time
	vmmResumedAt    time.Time
	guestRestoredAt time.Time
	guest           restoredGuestTimings
}

func (b *Backend) restoreLocked(ctx context.Context, instanceID string, startOptions types.StartOptions) error {
	timings := restoreTimings{startedAt: time.Now()}
	metadata, err := b.readInstance(instanceID)
	if err != nil {
		return err
	}
	if err := validateRequestedTransition(lifecycle.OperationRestore, metadata.State); err != nil {
		return err
	}
	if metadata.State == types.RuntimeStateStarted {
		return nil
	}
	if err := b.validateStandbyRestore(ctx, metadata); err != nil {
		return err
	}
	restoreResources := activeInstanceResources(metadata)
	if instanceNetworkEnabled(metadata) && !instanceHasNetwork(metadata) {
		restoreResources.NetworkSlots = 1
	}
	reservation, err := b.reserveResources(ctx, instanceID, restoreResources)
	if err != nil {
		return err
	}
	defer reservation.Finish()
	attempt := &restoreAttempt{
		metadata:              metadata,
		snapshotDir:           b.paths.InstanceLatestSnapshot(instanceID),
		initializationStarted: metadata.WorkloadInitialized,
	}
	if err := validateStandbySnapshot(attempt.metadata, attempt.snapshotDir); err != nil {
		return err
	}
	if err := b.beginRestore(ctx, attempt); err != nil {
		return err
	}
	timings.networkReadyAt = time.Now()
	if err := b.runRestore(ctx, attempt, startOptions, &timings); err != nil {
		return b.failRestore(ctx, attempt, err)
	}
	logRestoreReady(ctx, attempt.metadata, timings)
	return nil
}

func (b *Backend) validateStandbyRestore(ctx context.Context, metadata state.InstanceMetadata) error {
	if metadata.State != types.RuntimeStateStandby {
		return stateConflict("instance must be in standby before it can be restored", "MICROVM_RESTORE_REQUIRES_STANDBY_STATE")
	}
	if err := b.ensurePersistedPlatformBundles(ctx, metadata); err != nil {
		return err
	}
	if metadata.GPUQuota > 0 {
		return stateConflict("standby restore is not supported for GPU instances", "MICROVM_GPU_RESTORE_UNSUPPORTED")
	}
	return b.validateResourceShape(activeInstanceResources(metadata))
}

func validateStandbySnapshot(metadata state.InstanceMetadata, snapshotDir string) error {
	if info, statErr := os.Stat(snapshotDir); statErr != nil || !info.IsDir() {
		return mvmerrors.New(http.StatusConflict, "instance does not have a standby snapshot to restore", "MICROVM_STANDBY_SNAPSHOT_MISSING")
	}
	if metadata.SnapshotFailureCode != "" {
		return mvmerrors.New(
			http.StatusConflict,
			"instance standby snapshot was invalidated after a terminal restore failure",
			metadata.SnapshotFailureCode,
		)
	}
	if !metadata.SnapshotIdentityQuiesced || metadata.SnapshotControlAuthToken == "" {
		return mvmerrors.New(
			http.StatusConflict,
			"instance standby snapshot does not contain a restorable guest identity",
			"MICROVM_STANDBY_IDENTITY_MISSING",
		)
	}
	return nil
}

func (b *Backend) beginRestore(ctx context.Context, attempt *restoreAttempt) error {
	if !attempt.metadata.RestoreIdentityPending {
		if err := rotateInstanceIdentity(&attempt.metadata, attempt.metadata.SnapshotControlAuthToken); err != nil {
			return fmt.Errorf("rotate instance restore identity: %w", err)
		}
		attempt.metadata.RestoreIdentityPending = true
	}
	allocatedNetwork, err := b.attachInstanceNetwork(ctx, &attempt.metadata)
	if err != nil {
		return fmt.Errorf("attach standby restore network: %w", err)
	}
	attempt.allocatedNetwork = allocatedNetwork
	if err := b.persistRuntimeState(&attempt.metadata, types.RuntimeStateRestoring); err != nil {
		persistErr := fmt.Errorf("persist instance restore intent: %w", err)
		if !allocatedNetwork {
			return persistErr
		}
		releaseErr := b.releaseNetwork(context.WithoutCancel(ctx), attempt.metadata)
		return errors.Join(persistErr, wrapOptionalError("release uncommitted standby restore network", releaseErr))
	}
	return nil
}

func (b *Backend) runRestore(
	ctx context.Context,
	attempt *restoreAttempt,
	startOptions types.StartOptions,
	timings *restoreTimings,
) error {
	spec, err := b.buildSpec(ctx, attempt.metadata)
	if err != nil {
		return err
	}
	timings.specReadyAt = time.Now()
	if err := runLifecycleAction(b, attempt.metadata.ID, lifecycle.OperationSnapshotRestore, func() error {
		var restoreErr error
		attempt.process, restoreErr = b.restoreVM(ctx, spec, attempt.snapshotDir)
		return restoreErr
	}); err != nil {
		return err
	}
	timings.vmmRestoredAt = time.Now()
	if err := b.resumeVM(ctx, attempt.metadata); err != nil {
		return classifyPostResumeRestoreFailure(spec, attempt.process, err)
	}
	timings.vmmResumedAt = time.Now()
	initialization, err := restoreWorkloadInitialization(attempt.metadata, startOptions)
	if err != nil {
		return newRestoreFailure(restoreFailureGuestReadiness, err)
	}
	guestClient, err := b.restoreGuest(ctx, &attempt.metadata, initialization)
	attempt.initializationStarted = attempt.initializationStarted || (initialization != nil && restoreReachedWorkload(err))
	if err != nil {
		return classifyPostResumeRestoreFailure(spec, attempt.process, err)
	}
	defer guestClient.Close()
	timings.guestRestoredAt = time.Now()
	if timings.guest, err = b.completeRestoredGuest(ctx, &attempt.metadata, guestClient); err != nil {
		return classifyPostResumeRestoreFailure(spec, attempt.process, err)
	}
	committed := attempt.metadata
	committed.RestoreIdentityPending = false
	committed.SnapshotIdentityQuiesced = false
	committed.SnapshotControlAuthToken = ""
	if err := b.commitStarted(&committed, attempt.process); err != nil {
		return err
	}
	attempt.metadata = committed
	return nil
}

func (b *Backend) failRestore(ctx context.Context, attempt *restoreAttempt, cause error) error {
	cleanupCtx := context.WithoutCancel(ctx)
	invalidateSnapshotAfterRestoreFailure(&attempt.metadata, cause)
	if cleanupErr := b.cleanupFailedRestore(ctx, &attempt.metadata, attempt.process); cleanupErr != nil {
		attempt.metadata.PID = 0
		if attempt.process.Running() {
			attempt.metadata.PID = attempt.process.PID
		}
		persistErr := b.persistRuntimeState(&attempt.metadata, types.RuntimeStateError)
		return errors.Join(cause, cleanupErr, wrapOptionalError("persist instance with incomplete restore cleanup", persistErr))
	}
	if attempt.allocatedNetwork {
		releaseErr := b.releaseNetwork(cleanupCtx, attempt.metadata)
		cause = errors.Join(cause, wrapOptionalError("release failed standby restore network", releaseErr))
		clearNetworkIdentity(&attempt.metadata)
		attempt.allocatedNetwork = false
	}
	attempt.metadata.PID = 0
	persistErr := b.persistRuntimeState(&attempt.metadata, types.RuntimeStateStandby)
	failure := errors.Join(cause, wrapOptionalError("persist failed instance restore", persistErr))
	if attempt.metadata.TemplateKey != "" && !attempt.initializationStarted {
		return templateUnavailable(failure)
	}
	return failure
}

func logRestoreReady(ctx context.Context, metadata state.InstanceMetadata, timings restoreTimings) {
	slog.InfoContext(
		ctx,
		"microVM snapshot restore ready",
		"instance_id", metadata.ID,
		"template_restore", metadata.TemplateKey != "",
		"total_ms", time.Since(timings.startedAt).Milliseconds(),
		"network_ms", timings.networkReadyAt.Sub(timings.startedAt).Milliseconds(),
		"spec_ms", timings.specReadyAt.Sub(timings.networkReadyAt).Milliseconds(),
		"vmm_restore_ms", timings.vmmRestoredAt.Sub(timings.specReadyAt).Milliseconds(),
		"vmm_resume_ms", timings.vmmResumedAt.Sub(timings.vmmRestoredAt).Milliseconds(),
		"guest_restore_ms", timings.guestRestoredAt.Sub(timings.vmmResumedAt).Milliseconds(),
		"guest_services_ms", timings.guest.servicesReadyAt.Sub(timings.guestRestoredAt).Milliseconds(),
		"workload_ready_ms", timings.guest.workloadReadyAt.Sub(timings.guest.servicesReadyAt).Milliseconds(),
		"commit_ms", time.Since(timings.guest.workloadReadyAt).Milliseconds(),
	)
}
