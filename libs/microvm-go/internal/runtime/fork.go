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
	"maps"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/snapshot"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

type forkSource struct {
	metadata       state.InstanceMetadata
	snapshotRecord *snapshot.Record
}

type forkOptions struct {
	shareSnapshotMemory bool
}

type forkSourceRestorer struct {
	restore func() error
}

func (restorer *forkSourceRestorer) run() error {
	if restorer.restore == nil {
		return nil
	}
	restore := restorer.restore
	restorer.restore = nil
	return restore()
}

func templateSnapshotMemoryRelativePath() string {
	return filepath.Join("snapshots", "latest", "memory")
}

func (b *Backend) Fork(ctx context.Context, instanceID string, request types.ForkRequest) (string, error) {
	return b.forkWithOptions(ctx, instanceID, request, forkOptions{})
}

func (b *Backend) forkWithOptions(ctx context.Context, instanceID string, request types.ForkRequest, options forkOptions) (string, error) {
	if uuid.Validate(instanceID) != nil || uuid.Validate(request.ID) != nil {
		return "", mvmerrors.NewInvalidRequest(errors.New("source and fork instance ids must be UUIDs"))
	}
	if request.AssignmentGeneration < 1 {
		return "", mvmerrors.NewInvalidRequest(errors.New("fork assignment generation must be positive"))
	}
	return runLifecycleOperation(b, instanceID, request.ID, lifecycle.OperationFork, func() (string, error) {
		guard, err := b.lockForkMutation(ctx, instanceID, request.ID)
		if err != nil {
			return "", fmt.Errorf("acquire fork lifecycle locks: %w", err)
		}
		defer guard.Release()
		return b.forkLocked(ctx, instanceID, request, options)
	})
}

func (b *Backend) forkLocked(ctx context.Context, instanceID string, request types.ForkRequest, options forkOptions) (forkID string, returnErr error) {
	sourceData, err := b.loadForkSource(instanceID, request.SnapshotID)
	if err != nil {
		return "", err
	}
	if err := validateForkRequest(instanceID, sourceData); err != nil {
		return "", err
	}
	if _, err := os.Stat(b.paths.InstanceDir(request.ID)); err == nil {
		return b.reconcileExistingFork(ctx, instanceID, request)
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("check fork target instance: %w", err)
	}
	reservation, err := b.reserveFork(ctx, sourceData.metadata, request.ID, options)
	if err != nil {
		return "", err
	}
	defer reservation.Finish()
	transaction := lifecycle.NewTransaction()
	defer func() {
		if rollbackErr := transaction.Rollback(ctx); rollbackErr != nil {
			returnErr = errors.Join(returnErr, rollbackErr)
		}
	}()
	fastFork, restorer, err := b.prepareForkSnapshotSource(ctx, sourceData)
	if err != nil {
		return "", err
	}
	defer func() {
		returnErr = errors.Join(returnErr, restorer.run())
	}()
	if err := b.materializeForkTarget(transaction, sourceData, request.ID, options); err != nil {
		return "", err
	}
	forked, err := b.composeFork(ctx, transaction, sourceData.metadata, request, fastFork)
	if err != nil {
		return "", err
	}
	if err := state.WriteInstanceMetadata(b.paths, forked); err != nil {
		return "", err
	}
	if err := restorer.run(); err != nil {
		return "", err
	}
	transaction.Commit()
	reservation.Finish()
	return b.startFork(ctx, request)
}

func validateForkRequest(instanceID string, sourceData forkSource) error {
	source := sourceData.metadata
	if err := validateRequestedTransition(lifecycle.OperationFork, source.State); err != nil {
		return err
	}
	if sourceData.snapshotRecord == nil {
		if err := validateForkSource(source); err != nil {
			return err
		}
	}
	if source.ID != instanceID {
		return stateConflict("snapshot source does not match the requested instance", "MICROVM_SNAPSHOT_SOURCE_MISMATCH")
	}
	if forkCapturesMemory(source, sourceData.snapshotRecord) {
		if err := validateMemorySnapshotPolicy(source); err != nil {
			return err
		}
	}
	return validateForkSnapshotKind(sourceData.snapshotRecord)
}

func (b *Backend) reserveFork(
	ctx context.Context,
	source state.InstanceMetadata,
	forkID string,
	options forkOptions,
) (*resourceReservation, error) {
	if err := b.validateResourceShape(activeInstanceResources(source)); err != nil {
		return nil, err
	}
	forkReservation := storedInstanceResources(source)
	if !options.shareSnapshotMemory {
		forkReservation.DiskGiB += source.MemoryQuota
	}
	return b.reserveResources(ctx, forkID, forkReservation)
}

func (b *Backend) prepareForkSnapshotSource(ctx context.Context, sourceData forkSource) (bool, *forkSourceRestorer, error) {
	if sourceData.snapshotRecord != nil {
		return sourceData.snapshotRecord.Snapshot.Kind == snapshot.KindStandby, &forkSourceRestorer{}, nil
	}
	fastFork, restoreSource, err := b.prepareFastForkSource(ctx, sourceData.metadata)
	if err != nil {
		return false, nil, err
	}
	return fastFork, &forkSourceRestorer{restore: restoreSource}, nil
}

func (b *Backend) materializeForkTarget(transaction *lifecycle.Transaction,
	sourceData forkSource,
	forkID string,
	options forkOptions,
) error {
	targetDir := b.paths.InstanceDir(forkID)
	if err := b.materializeForkSourceWithOptions(sourceData, targetDir, forkID, options); err != nil {
		return errors.Join(
			fmt.Errorf("materialize instance fork source: %w", err),
			wrapOptionalError("remove partial fork target", os.RemoveAll(targetDir)),
		)
	}
	return transaction.Defer("fork target directory", func(context.Context) error {
		return os.RemoveAll(targetDir)
	})
}

func (b *Backend) composeFork(
	ctx context.Context,
	transaction *lifecycle.Transaction,
	source state.InstanceMetadata,
	request types.ForkRequest,
	fastFork bool,
) (state.InstanceMetadata, error) {
	forked, err := b.newForkInstance(source, request, fastFork)
	if err != nil {
		return state.InstanceMetadata{}, err
	}
	if fastFork && b.capabilities(forked.Hypervisor).ForkEmbedsNetwork {
		if err := b.attachForkNetwork(ctx, transaction, &forked); err != nil {
			return state.InstanceMetadata{}, err
		}
	}
	if err := b.writeForkConfigDrive(source, forked); err != nil {
		return state.InstanceMetadata{}, err
	}
	if fastFork {
		if err := b.applyForkSnapshot(ctx, source, &forked); err != nil {
			return state.InstanceMetadata{}, err
		}
	}
	return forked, nil
}

func (b *Backend) newForkInstance(source state.InstanceMetadata, request types.ForkRequest, fastFork bool) (state.InstanceMetadata, error) {
	forked, err := newForkMetadata(source, request)
	if err != nil {
		return state.InstanceMetadata{}, err
	}
	if err := initializeInstanceIdentity(&forked); err != nil {
		return state.InstanceMetadata{}, fmt.Errorf("initialize fork instance identity: %w", err)
	}
	b.finalizeForkPaths(&forked)
	if !fastFork {
		if err := os.RemoveAll(b.paths.InstanceLatestSnapshot(request.ID)); err != nil {
			return state.InstanceMetadata{}, fmt.Errorf("remove inherited fork snapshot: %w", err)
		}
	}
	forked.NetworkEnabled = instanceNetworkEnabled(source)
	clearNetworkIdentity(&forked)
	return forked, nil
}

func (b *Backend) writeForkConfigDrive(source, forked state.InstanceMetadata) error {
	if source.TemplateSeed {
		return nil
	}
	record, err := b.instanceImageRecord(source)
	if err != nil {
		return err
	}
	if err := b.writeInstanceConfigDrive(forked, record); err != nil {
		return fmt.Errorf("write fork config drive: %w", err)
	}
	return nil
}

func (b *Backend) attachForkNetwork(ctx context.Context, transaction *lifecycle.Transaction, forked *state.InstanceMetadata) error {
	allocated, err := b.attachInstanceNetwork(ctx, forked)
	if err != nil {
		return fmt.Errorf("attach fork network: %w", err)
	}
	if !allocated {
		return nil
	}
	return transaction.Defer("fork target network", func(rollbackCtx context.Context) error {
		return b.releaseNetwork(rollbackCtx, *forked)
	})
}

func (b *Backend) applyForkSnapshot(ctx context.Context, source state.InstanceMetadata, forked *state.InstanceMetadata) error {
	prepared, err := b.prepareForkSnapshot(ctx, source, forked)
	if err != nil {
		return fmt.Errorf("prepare fork snapshot: %w", err)
	}
	if !prepared {
		if err := os.RemoveAll(b.paths.InstanceLatestSnapshot(forked.ID)); err != nil {
			return fmt.Errorf("remove incompatible fork snapshot: %w", err)
		}
		return nil
	}
	forked.State = types.RuntimeStateStandby
	forked.SnapshotIdentityQuiesced = true
	forked.RestoreIdentityPending = true
	forked.RestoreControlAuthToken = source.ControlAuthToken
	forked.SnapshotControlAuthToken = source.ControlAuthToken
	return nil
}

func (b *Backend) startFork(ctx context.Context, request types.ForkRequest) (string, error) {
	if !request.Start {
		return request.ID, nil
	}
	if err := b.startLocked(ctx, request.ID, types.StartOptions{SecretEnv: maps.Clone(request.SecretEnv)}); err != nil {
		cleanupErr := b.destroyLocked(context.WithoutCancel(ctx), request.ID)
		return "", errors.Join(err, wrapOptionalError("clean up fork after start failure", cleanupErr))
	}
	return request.ID, nil
}

func (b *Backend) reconcileExistingFork(ctx context.Context, sourceInstanceID string, request types.ForkRequest) (string, error) {
	target, err := b.readInstance(request.ID)
	if err != nil {
		return "", fmt.Errorf("inspect existing fork target: %w", err)
	}
	if target.ForkSourceInstanceID != sourceInstanceID {
		return "", mvmerrors.New(http.StatusConflict, "fork target belongs to a different source", "MICROVM_FORK_TARGET_CONFLICT")
	}
	if err := b.admitAssignmentGeneration(&target, request.AssignmentGeneration); err != nil {
		return "", err
	}
	if request.Start {
		if target.State == types.RuntimeStateStarted && b.processRunning(ctx, target) {
			return request.ID, nil
		}
		if target.State == types.RuntimeStateStopped {
			if err := b.startLocked(ctx, request.ID, types.StartOptions{SecretEnv: maps.Clone(request.SecretEnv)}); err != nil {
				return "", err
			}
			return request.ID, nil
		}
		return "", stateConflict("fork target cannot complete its requested start", "MICROVM_FORK_TARGET_INCOMPLETE")
	}
	if target.State != types.RuntimeStateStopped {
		return "", stateConflict("fork target does not match the requested stopped state", "MICROVM_FORK_TARGET_STATE_CONFLICT")
	}
	return request.ID, nil
}

func forkCapturesMemory(source state.InstanceMetadata, record *snapshot.Record) bool {
	if record != nil {
		return record.Snapshot.Kind == snapshot.KindStandby
	}
	return source.State == types.RuntimeStateStarted || source.State == types.RuntimeStateStandby
}
