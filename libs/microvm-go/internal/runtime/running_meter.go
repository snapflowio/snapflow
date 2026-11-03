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
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func meterRunningTransition(meter *state.RunningMeter, next types.RuntimeState, at time.Time) {
	running := next == types.RuntimeStateStarted
	switch {
	case running && meter.Since == nil:
		meter.Since, meter.ObservedAt = &at, &at
	case running:
		observeRunning(meter, at)
	case meter.Since != nil:
		meter.Millis += elapsedMillis(*meter.Since, at)
		meter.Since, meter.ObservedAt = nil, nil
	}
}

func observeRunning(meter *state.RunningMeter, at time.Time) {
	if meter.Since != nil && (meter.ObservedAt == nil || at.After(*meter.ObservedAt)) {
		meter.ObservedAt = &at
	}
}

func lastObservedRunning(meter state.RunningMeter) time.Time {
	if meter.ObservedAt != nil {
		return *meter.ObservedAt
	}
	return *meter.Since
}

func runningMillis(meter state.RunningMeter) uint64 {
	if meter.Since == nil {
		return meter.Millis
	}
	return meter.Millis + elapsedMillis(*meter.Since, lastObservedRunning(meter))
}

func elapsedMillis(since, now time.Time) uint64 {
	if !now.After(since) {
		return 0
	}
	return uint64(now.Sub(since).Milliseconds())
}
