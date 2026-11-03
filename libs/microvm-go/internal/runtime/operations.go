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
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
)

func runLifecycleOperation[T any](backend *Backend,
	instanceID string,
	targetID string,
	operation lifecycle.Operation,
	run func() (T, error),
) (result T, returnErr error) {
	operationID := uuid.NewString()
	startedAt := time.Now()
	backend.events.Publish(lifecycle.Event{
		OperationID: operationID,
		InstanceID:  instanceID,
		TargetID:    targetID,
		Operation:   operation,
		Phase:       lifecycle.PhaseStarted,
		Timestamp:   startedAt.UTC(),
	})
	defer func() {
		phase := lifecycle.PhaseSucceeded
		if returnErr != nil {
			phase = lifecycle.PhaseFailed
		}
		backend.events.Publish(lifecycle.Event{
			OperationID: operationID,
			InstanceID:  instanceID,
			TargetID:    targetID,
			Operation:   operation,
			Phase:       phase,
			Reason:      lifecycleFailureReason(returnErr),
			Timestamp:   time.Now().UTC(),
			Duration:    time.Since(startedAt),
			Err:         returnErr,
		})
	}()
	return run()
}

func lifecycleFailureReason(err error) string {
	if err == nil {
		return ""
	}
	type errorCoder interface {
		ErrorCode() string
	}
	var coded errorCoder
	if errors.As(err, &coded) {
		return coded.ErrorCode()
	}
	return "UNCLASSIFIED_FAILURE"
}

func runLifecycleAction(backend *Backend,
	instanceID string,
	operation lifecycle.Operation,
	run func() error,
) error {
	_, err := runLifecycleOperation(backend, instanceID, "", operation, func() (struct{}, error) {
		return struct{}{}, run()
	})
	return err
}
