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

package healthcheck

import (
	"strings"
	"time"
)

const maxLastErrorLength = 512

func Apply(policy *Policy, previous *Runtime, startedAt, now time.Time, result ProbeResult) *Runtime {
	runtimeState := cloneRuntime(previous)
	if runtimeState == nil {
		runtimeState = &Runtime{}
	}
	now = now.UTC()
	if runtimeState.StartedAt == nil || !runtimeState.StartedAt.Equal(startedAt) {
		started := startedAt.UTC()
		runtimeState = &Runtime{Status: StatusStarting, StartedAt: &started}
	}
	runtimeState.LastCheckedAt = &now
	timing, timingErr := ParseTiming(policy)
	if timingErr != nil {
		timing = Timing{StartPeriod: defaultStartPeriod}
	}
	inStartPeriod := now.Sub(startedAt) < timing.StartPeriod
	if result.Success {
		runtimeState.ConsecutiveSuccesses++
		runtimeState.ConsecutiveFailures = 0
		runtimeState.LastSuccessAt = &now
		runtimeState.LastError = ""
		if runtimeState.ConsecutiveSuccesses >= policy.SuccessThreshold {
			runtimeState.Status = StatusHealthy
		}
		return runtimeState
	}
	runtimeState.ConsecutiveFailures++
	runtimeState.ConsecutiveSuccesses = 0
	runtimeState.LastFailureAt = &now
	runtimeState.LastError = truncate(result.Error)
	if !inStartPeriod && runtimeState.ConsecutiveFailures >= policy.FailureThreshold {
		runtimeState.Status = StatusUnhealthy
	}
	return runtimeState
}

func cloneRuntime(value *Runtime) *Runtime {
	if value == nil {
		return nil
	}
	clone := *value
	return &clone
}

func truncate(value string) string {
	if len(value) <= maxLastErrorLength {
		return value
	}
	var result strings.Builder
	result.Grow(maxLastErrorLength)
	for _, character := range value {
		if result.Len()+len(string(character)) > maxLastErrorLength {
			break
		}
		result.WriteRune(character)
	}
	return result.String()
}
