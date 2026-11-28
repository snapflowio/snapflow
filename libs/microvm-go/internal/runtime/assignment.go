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
	"net/http"

	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
)

const unassertedAssignmentGeneration = 0

var ErrStaleAssignment = errors.New("instance assignment generation is stale")

const StaleAssignmentErrorCode = "MICROVM_ASSIGNMENT_GENERATION_STALE"

func (b *Backend) AdmitAssignment(ctx context.Context, instanceID string, generation int) error {
	if generation <= unassertedAssignmentGeneration {
		return mvmerrors.NewInvalidRequest(fmt.Errorf("assignment generation %d must be positive", generation))
	}
	guard, err := b.lifecycle.Lock(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("acquire instance lifecycle lock: %w", err)
	}
	defer guard.Release()
	metadata, err := b.readInstance(instanceID)
	if err != nil {
		return err
	}
	return b.admitAssignmentGeneration(&metadata, generation)
}

func (b *Backend) admitAssignmentGeneration(metadata *state.InstanceMetadata, generation int) error {
	if generation < unassertedAssignmentGeneration {
		return mvmerrors.NewInvalidRequest(fmt.Errorf("assignment generation %d must not be negative", generation))
	}
	current := metadata.Identity.AssignmentGeneration
	if generation == unassertedAssignmentGeneration || generation == current {
		return nil
	}
	if generation < current {
		return mvmerrors.NewWithCause(
			http.StatusConflict,
			fmt.Sprintf("instance %s assignment generation %d is older than persisted generation %d", metadata.ID, generation, current),
			StaleAssignmentErrorCode,
			ErrStaleAssignment,
		)
	}
	metadata.Identity.AssignmentGeneration = generation
	metadata.RawRequest.Identity.AssignmentGeneration = generation
	if err := b.writeInstance(*metadata); err != nil {
		return fmt.Errorf("persist instance assignment generation %d: %w", generation, err)
	}
	return nil
}
