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

package metrics

import (
	"sync"
	"testing"
	"time"
)

func TestRecorderAggregatesAndSortsOperations(t *testing.T) {
	recorder := NewRecorder()
	now := time.Date(2026, 7, 14, 12, 0, 0, 0, time.UTC)
	recorder.Observe(Observation{Operation: "restore", Phase: PhaseStarted, Timestamp: now})
	recorder.Observe(Observation{Operation: "restore", Phase: PhaseSucceeded, Timestamp: now.Add(time.Second), Duration: time.Second})
	recorder.Observe(Observation{Operation: "restore", Phase: PhaseFailed, Reason: "SNAPSHOT_CORRUPT", Timestamp: now.Add(3 * time.Second), Duration: 2 * time.Second})
	recorder.RecordDroppedEvent("restore")
	recorder.Observe(Observation{Operation: "create", Phase: PhaseSucceeded, Timestamp: now, Duration: 500 * time.Millisecond})

	snapshot := recorder.Snapshot()
	if len(snapshot) != 2 || snapshot[0].Operation != "create" || snapshot[1].Operation != "restore" {
		t.Fatalf("unexpected sorted snapshot: %+v", snapshot)
	}
	restore := snapshot[1]
	if restore.StartedCount != 1 || restore.SucceededCount != 1 || restore.FailedCount != 1 {
		t.Fatalf("unexpected restore counts: %+v", restore)
	}
	if restore.DroppedEventCount != 1 {
		t.Fatalf("unexpected dropped event count: %+v", restore)
	}
	if restore.OutcomeReasons["SNAPSHOT_CORRUPT"] != 1 {
		t.Fatalf("unexpected restore outcome reasons: %+v", restore.OutcomeReasons)
	}
	if restore.AverageDurationMs != 1500 || restore.MaximumDurationMs != 2000 || restore.LastDurationMs != 2000 {
		t.Fatalf("unexpected restore durations: %+v", restore)
	}
	if restore.P50DurationMs != 1000 || restore.P95DurationMs != 2000 {
		t.Fatalf("unexpected restore percentiles: %+v", restore)
	}
}

func TestRecorderIsConcurrentSafe(t *testing.T) {
	recorder := NewRecorder()
	var wait sync.WaitGroup
	for range 20 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			for range 100 {
				recorder.Observe(Observation{Operation: "health_check", Phase: PhaseSucceeded, Timestamp: time.Now(), Duration: time.Millisecond})
			}
		}()
	}
	wait.Wait()
	snapshot := recorder.Snapshot()
	if len(snapshot) != 1 || snapshot[0].SucceededCount != 2000 {
		t.Fatalf("unexpected concurrent snapshot: %+v", snapshot)
	}
}
