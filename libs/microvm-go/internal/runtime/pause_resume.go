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
	"time"

	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) Resume(ctx context.Context, instanceID string) error {
	return runLifecycleAction(b, instanceID, lifecycle.OperationResume, func() error {
		guard, err := b.lockInstanceMutation(ctx, instanceID)
		if err != nil {
			return fmt.Errorf("acquire instance lifecycle lock: %w", err)
		}
		defer guard.Release()
		return b.resumeLocked(ctx, instanceID)
	})
}

func (b *Backend) resumeLocked(ctx context.Context, instanceID string) error {
	metadata, err := b.readInstance(instanceID)
	if err != nil {
		return err
	}
	if err := validateRequestedTransition(lifecycle.OperationResume, metadata.State); err != nil {
		return err
	}
	switch metadata.State {
	case types.RuntimeStateStarted:
		return nil
	case types.RuntimeStateStandby:
		return b.restoreLocked(ctx, instanceID, types.StartOptions{})
	case types.RuntimeStatePaused:
	default:
		return stateConflict("instance must be paused or in standby before it can be resumed", "MICROVM_RESUME_REQUIRES_PAUSED_STATE")
	}
	previous := metadata
	if err := b.resumeVM(ctx, metadata); err != nil {
		return err
	}
	if err := b.waitForGuestReady(ctx, metadata); err != nil {
		pauseErr := b.pauseVM(context.WithoutCancel(ctx), previous)
		return errors.Join(
			fmt.Errorf("wait for resumed guest readiness: %w", err),
			wrapOptionalError("pause instance after resume readiness failure", pauseErr),
		)
	}
	now := time.Now().UTC()
	metadata.StartedAt = &now
	metadata.StoppedAt = nil
	if err := b.persistRuntimeState(&metadata, types.RuntimeStateStarted); err != nil {
		pauseErr := b.pauseVM(context.WithoutCancel(ctx), previous)
		return errors.Join(
			fmt.Errorf("persist resumed instance state: %w", err),
			wrapOptionalError("pause instance after state persistence failure", pauseErr),
		)
	}
	return nil
}
