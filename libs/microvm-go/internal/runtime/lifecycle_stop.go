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
	"time"

	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
)

const (
	stopPersistIntentPhase = "persist_intent_ms"
	stopQuiescePhase       = "quiesce_ms"
	stopVMMPhase           = "vmm_stop_ms"
	stopReleasePhase       = "release_ms"
	stopCommitPhase        = "commit_ms"
)

func (b *Backend) StopWithOptions(ctx context.Context, instanceID string, options types.StopOptions) error {
	return runLifecycleAction(b, instanceID, lifecycle.OperationStop, func() error {
		guard, err := b.lockInstanceMutation(ctx, instanceID)
		if err != nil {
			return fmt.Errorf("acquire instance lifecycle lock: %w", err)
		}
		defer guard.Release()
		return b.stopLockedWithOptions(ctx, instanceID, options)
	})
}

func (b *Backend) stopLockedWithOptions(ctx context.Context, instanceID string, options types.StopOptions) error {
	startedAt := time.Now()
	metadata, stopping, err := b.loadStopTarget(instanceID, options)
	if err != nil || !stopping {
		return err
	}
	timer := &phaseTimer{}
	if err := timer.time(stopPersistIntentPhase, func() error {
		return b.persistRuntimeState(&metadata, types.RuntimeStateStopping)
	}); err != nil {
		return fmt.Errorf("persist stopping instance state: %w", err)
	}
	quiesced, stopErr, err := b.haltInstanceVMM(ctx, &metadata, options, timer)
	if err != nil {
		return err
	}
	releaseErr := timer.time(stopReleasePhase, func() error {
		return b.releaseGPUDevices(ctx, &metadata)
	})
	if releaseErr != nil {
		return errors.Join(stopErr, releaseErr)
	}
	snapshotCleanupErr := b.resetStoppedInstance(&metadata)
	if err := timer.time(stopCommitPhase, func() error {
		return b.persistRuntimeState(&metadata, types.RuntimeStateStopped)
	}); err != nil {
		return errors.Join(stopErr, snapshotCleanupErr, fmt.Errorf("persist stopped instance state: %w", err))
	}
	slog.InfoContext(ctx, "microVM instance stopped", append([]any{
		"instance_id", metadata.ID,
		"hypervisor", metadata.Hypervisor,
		"quiesced", quiesced,
		"total_ms", time.Since(startedAt).Milliseconds(),
	}, timer.attributes...)...)
	return errors.Join(stopErr, snapshotCleanupErr)
}

func (b *Backend) loadStopTarget(instanceID string, options types.StopOptions) (state.InstanceMetadata, bool, error) {
	if options.GracePeriod < 0 {
		return state.InstanceMetadata{}, false, mvmerrors.NewInvalidRequest(errors.New("stop grace period must not be negative"))
	}
	metadata, err := b.readInstance(instanceID)
	if err != nil {
		return state.InstanceMetadata{}, false, err
	}
	if err := b.admitAssignmentGeneration(&metadata, options.AssignmentGeneration); err != nil {
		return state.InstanceMetadata{}, false, err
	}
	if err := validateRequestedTransition(lifecycle.OperationStop, metadata.State); err != nil {
		return state.InstanceMetadata{}, false, err
	}
	if metadata.State == types.RuntimeStateStopped {
		return metadata, false, nil
	}
	if err := ensureInstanceNotLinked(metadata, "stop"); err != nil {
		return state.InstanceMetadata{}, false, mvmerrors.NewInvalidRequest(err)
	}
	return metadata, true, nil
}

func (b *Backend) haltInstanceVMM(
	ctx context.Context,
	metadata *state.InstanceMetadata,
	options types.StopOptions,
	timer *phaseTimer,
) (bool, error, error) {
	process := b.runningProcess(ctx, *metadata)
	quiesced := false
	if !options.Force && process.Running() {
		if err := timer.time(stopQuiescePhase, func() error {
			return b.prepareGuestForSnapshot(ctx, *metadata)
		}); err != nil {
			return false, nil, fmt.Errorf("quiesce guest filesystem before stop: %w", err)
		}
		quiesced = true
	}
	stopErr := timer.time(stopVMMPhase, func() error {
		if quiesced {
			return b.killVM(ctx, *metadata, process)
		}
		return b.stopVMWithOptions(ctx, metadata, options)
	})
	if stopErr == nil || !b.processRunning(ctx, *metadata) {
		return quiesced, stopErr, nil
	}
	if !quiesced {
		return quiesced, nil, stopErr
	}
	resumeErr := b.resumeGuestAfterSnapshot(context.WithoutCancel(ctx), *metadata)
	if resumeErr == nil {
		resumeErr = b.persistRuntimeState(metadata, types.RuntimeStateStarted)
	}
	return quiesced, nil, errors.Join(stopErr, wrapOptionalError("resume guest after failed stop", resumeErr))
}

func (b *Backend) resetStoppedInstance(metadata *state.InstanceMetadata) error {
	if metadata.RestartPolicy != nil {
		metadata.RestartStatus = restartpolicy.ManualStopStatus()
	}
	now := time.Now().UTC()
	metadata.PID = 0
	metadata.StoppedAt = &now
	metadata.SnapshotIdentityQuiesced = false
	metadata.RestoreIdentityPending = false
	metadata.SnapshotControlAuthToken = ""
	metadata.RestoreControlAuthToken = ""
	return b.discardLatestSnapshot(metadata.ID)
}
