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
	"fmt"

	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/types"
)

const invalidRequestedTransitionCode = "MICROVM_INVALID_STATE_TRANSITION"

type requestedTransitionPolicy struct {
	allowed   map[types.RuntimeState]struct{}
	satisfied map[types.RuntimeState]struct{}
}

func requestedTransitionPolicies() map[lifecycle.Operation]requestedTransitionPolicy {
	return map[lifecycle.Operation]requestedTransitionPolicy{
		lifecycle.OperationStart: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStatePaused, types.RuntimeStateStandby, types.RuntimeStateStopped, types.RuntimeStateError},
			[]types.RuntimeState{types.RuntimeStateStarted},
		),
		lifecycle.OperationStop: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStateStarted, types.RuntimeStatePaused, types.RuntimeStateStandby, types.RuntimeStateError},
			[]types.RuntimeState{types.RuntimeStateStopped},
		),
		lifecycle.OperationDestroy: newRequestedTransitionPolicy(
			[]types.RuntimeState{
				types.RuntimeStateCreating,
				types.RuntimeStateRestoring,
				types.RuntimeStateDestroying,
				types.RuntimeStateStarted,
				types.RuntimeStatePaused,
				types.RuntimeStateStandby,
				types.RuntimeStateStopped,
				types.RuntimeStateStarting,
				types.RuntimeStateStopping,
				types.RuntimeStateResizing,
				types.RuntimeStateError,
				types.RuntimeStatePullingImage,
			},
			[]types.RuntimeState{types.RuntimeStateDestroyed},
		),
		lifecycle.OperationResize: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStateStopped},
			nil,
		),
		lifecycle.OperationPause: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStateStarted},
			[]types.RuntimeState{types.RuntimeStatePaused},
		),
		lifecycle.OperationResume: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStatePaused, types.RuntimeStateStandby},
			[]types.RuntimeState{types.RuntimeStateStarted},
		),
		lifecycle.OperationStandby: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStateStarted},
			[]types.RuntimeState{types.RuntimeStateStandby},
		),
		lifecycle.OperationRestore: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStateStandby},
			[]types.RuntimeState{types.RuntimeStateStarted},
		),
		lifecycle.OperationCreateSnapshot: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStateStarted, types.RuntimeStateStopped, types.RuntimeStateError},
			nil,
		),
		lifecycle.OperationExportImage: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStateStarted, types.RuntimeStateStopped},
			nil,
		),
		lifecycle.OperationFork: newRequestedTransitionPolicy(
			[]types.RuntimeState{types.RuntimeStateStarted, types.RuntimeStateStandby, types.RuntimeStateStopped, types.RuntimeStateError},
			nil,
		),
	}
}

func newRequestedTransitionPolicy(allowed, satisfied []types.RuntimeState) requestedTransitionPolicy {
	return requestedTransitionPolicy{
		allowed:   runtimeStateSet(allowed),
		satisfied: runtimeStateSet(satisfied),
	}
}

func runtimeStateSet(states []types.RuntimeState) map[types.RuntimeState]struct{} {
	set := make(map[types.RuntimeState]struct{}, len(states))
	for _, runtimeState := range states {
		set[runtimeState] = struct{}{}
	}
	return set
}

func validateRequestedTransition(operation lifecycle.Operation, current types.RuntimeState) error {
	policy, ok := requestedTransitionPolicies()[operation]
	if !ok {
		return fmt.Errorf("requested transition policy is not defined for operation %q", operation)
	}
	if _, ok := policy.allowed[current]; ok {
		return nil
	}
	if _, ok := policy.satisfied[current]; ok {
		return nil
	}
	return stateConflict(
		fmt.Sprintf("operation %s is not valid while the instance is %s", operation, current),
		invalidRequestedTransitionCode,
	)
}
