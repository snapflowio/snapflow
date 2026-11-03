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
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

const (
	firstRun  = 650 * time.Millisecond
	pausedFor = 5 * time.Second
	secondRun = 1200 * time.Millisecond
)

func meterEpoch() time.Time {
	return time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
}

func TestRunningMeterCountsOnlyStartedTimeAcrossRuns(t *testing.T) {
	meter := &state.RunningMeter{}
	meterRunningTransition(meter, types.RuntimeStateStarted, meterEpoch())
	observeRunning(meter, meterEpoch().Add(firstRun))
	if got := runningMillis(*meter); got != uint64(firstRun.Milliseconds()) {
		t.Fatalf("running millis during the first run = %d", got)
	}
	stopped := meterEpoch().Add(firstRun)
	meterRunningTransition(meter, types.RuntimeStateStopping, stopped)
	meterRunningTransition(meter, types.RuntimeStateStopped, stopped.Add(pausedFor))
	if got := runningMillis(*meter); got != uint64(firstRun.Milliseconds()) {
		t.Fatalf("running millis while stopped = %d, want the first run only", got)
	}
	restarted := stopped.Add(pausedFor)
	meterRunningTransition(meter, types.RuntimeStateStarted, restarted)
	meterRunningTransition(meter, types.RuntimeStateStarted, restarted.Add(secondRun/2))
	observeRunning(meter, restarted.Add(secondRun))
	want := uint64((firstRun + secondRun).Milliseconds())
	if got := runningMillis(*meter); got != want {
		t.Fatalf("running millis after a restart = %d, want %d", got, want)
	}
}

func TestRunningMeterCountsOnlyVerifiedRunningTime(t *testing.T) {
	meter := &state.RunningMeter{}
	meterRunningTransition(meter, types.RuntimeStateStarted, meterEpoch())
	observeRunning(meter, meterEpoch().Add(firstRun))
	observeRunning(meter, meterEpoch())
	if got := runningMillis(*meter); got != uint64(firstRun.Milliseconds()) {
		t.Fatalf("running millis after an older observation = %d", got)
	}
	meterRunningTransition(meter, types.RuntimeStateStopped, lastObservedRunning(*meter))
	if meter.Millis != uint64(firstRun.Milliseconds()) || meter.Since != nil || meter.ObservedAt != nil {
		t.Fatalf("meter closed at the last observation = %+v", meter)
	}
}

func TestRunningMeterIgnoresAWallClockSteppedBackwards(t *testing.T) {
	meter := &state.RunningMeter{}
	meterRunningTransition(meter, types.RuntimeStateStarted, meterEpoch())
	meterRunningTransition(meter, types.RuntimeStateError, meterEpoch().Add(-time.Second))
	if meter.Millis != 0 || meter.Since != nil {
		t.Fatalf("meter after a backwards clock = %+v", meter)
	}
}
