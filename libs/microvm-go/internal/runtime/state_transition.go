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
	"os"
	"time"

	"github.com/snapflowio/microvm-go/hypervisor"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) commitStarted(metadata *state.InstanceMetadata, process hypervisor.Process) error {
	if err := hypervisor.WritePID(b.paths.InstancePID(metadata.ID), process); err != nil {
		terminateErr := hypervisor.Terminate(process, vmmTerminationGracePeriod)
		return errors.Join(
			fmt.Errorf("write VMM pid: %w", err),
			wrapOptionalError("terminate VMM after PID persistence failure", terminateErr),
		)
	}

	now := time.Now().UTC()
	metadata.PID = process.PID
	metadata.StartedAt = &now
	metadata.StoppedAt = nil
	metadata.ExitCode = nil
	metadata.ExitMessage = ""
	metadata.HealthCheckRuntime = nil
	if err := b.persistRuntimeState(metadata, types.RuntimeStateStarted); err != nil {
		terminateErr := hypervisor.Terminate(process, vmmTerminationGracePeriod)
		removeErr := os.Remove(b.paths.InstancePID(metadata.ID))
		if errors.Is(removeErr, os.ErrNotExist) {
			removeErr = nil
		}
		metadata.PID = 0
		rollbackErr := b.persistRuntimeState(metadata, types.RuntimeStateError)
		return errors.Join(
			fmt.Errorf("persist started instance state: %w", err),
			wrapOptionalError("terminate VMM after state failure", terminateErr),
			wrapOptionalError("remove VMM pid after state failure", removeErr),
			wrapOptionalError("persist instance rollback state", rollbackErr),
		)
	}
	return nil
}

func (b *Backend) persistRuntimeState(metadata *state.InstanceMetadata,
	next types.RuntimeState,
) error {
	if metadata == nil {
		return errors.New("instance metadata is required")
	}
	previousState, previousMeter := metadata.State, metadata.RunningMeter
	meterRunningTransition(&metadata.RunningMeter, next, time.Now().UTC())
	metadata.State = next
	if err := b.writeInstance(*metadata); err != nil {
		metadata.State, metadata.RunningMeter = previousState, previousMeter
		return err
	}
	return nil
}

func wrapOptionalError(message string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, err)
}
