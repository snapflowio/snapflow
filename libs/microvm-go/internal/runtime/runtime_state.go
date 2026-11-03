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
	"os"
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/restartpolicy"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) RuntimeInfo(ctx context.Context, instanceID string) (types.RuntimeInfo, error) {
	guard, err := b.lifecycle.Lock(ctx, instanceID)
	if err != nil {
		return types.RuntimeInfo{}, fmt.Errorf("acquire instance lifecycle lock: %w", err)
	}
	defer guard.Release()

	runtimeState, err := b.deduceRuntimeStateLocked(ctx, instanceID)
	if err != nil {
		return types.RuntimeInfo{}, fmt.Errorf("deduce instance state: %w", err)
	}
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if errors.Is(err, os.ErrNotExist) && runtimeState == types.RuntimeStateUnknown {
		return types.RuntimeInfo{State: runtimeState, RestartStatus: restartpolicy.Status{}}, nil
	}
	if err != nil {
		return types.RuntimeInfo{}, fmt.Errorf("read instance runtime info: %w", err)
	}
	info := runtimeInfoFromMetadata(metadata)
	info.State = runtimeState
	return info, nil
}

func (b *Backend) deduceRuntimeStateLocked(ctx context.Context, instanceID string) (types.RuntimeState, error) {
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return types.RuntimeStateUnknown, nil
		}
		return types.RuntimeStateError, err
	}
	if metadata.State == "" {
		return types.RuntimeStateUnknown, nil
	}
	if metadata.State != types.RuntimeStateStarted {
		return metadata.State, nil
	}
	if process := b.runningProcess(ctx, metadata); process.Running() {
		if err := b.adoptRunningProcess(&metadata, process); err != nil {
			return types.RuntimeStateError, err
		}
		return types.RuntimeStateStarted, nil
	}
	if err := b.recordExitedInstance(ctx, &metadata); err != nil {
		return types.RuntimeStateError, err
	}
	return types.RuntimeStateStopped, nil
}

func (b *Backend) recordExitedInstance(ctx context.Context, metadata *state.InstanceMetadata) error {
	if err := b.releaseGPUDevices(ctx, metadata); err != nil {
		return fmt.Errorf("release GPU lease for exited instance: %w", err)
	}
	if err := b.cleanupExitedRuntimeArtifacts(ctx, *metadata); err != nil {
		return err
	}
	metadata.PID = 0
	now := time.Now().UTC()
	metadata.StoppedAt = &now
	if err := b.persistRuntimeState(metadata, types.RuntimeStateStopped); err != nil {
		return fmt.Errorf("persist stopped state for exited instance: %w", err)
	}
	return nil
}
