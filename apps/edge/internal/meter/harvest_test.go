// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	concurrentWriters   = 8
	writesPerWriter     = 2_000
	bytesPerWrite       = 3
	concurrentHarvests  = 50
	expectedWriterBytes = concurrentWriters * writesPerWriter * bytesPerWrite
)

func testIdentity() backendIdentity {
	return backendIdentity{assignmentGeneration: 1, protocol: apiclient.NetworkProtocolTcp}
}

func harvestLocked(meter *Meter) {
	meter.mu.Lock()
	defer meter.mu.Unlock()
	meter.harvest()
}

func liveCounters(meter *Meter) int {
	meter.liveMu.Lock()
	defer meter.liveMu.Unlock()
	return len(meter.live)
}

func TestHarvestCountsConcurrentTrafficExactlyOnce(t *testing.T) {
	meter := newTestMeter(t, &scriptedUsageAPI{}, newTestSession(time.Now()))
	backendID := uuid.New()
	var writers sync.WaitGroup
	for range concurrentWriters {
		counter := openAttributedCounter(meter, backendID, testIdentity())
		writers.Go(func() {
			defer counter.Close()
			counter.AddConnection()
			for range writesPerWriter {
				counter.AddIngress(bytesPerWrite, 1)
				counter.AddEgress(bytesPerWrite, 0)
			}
		})
	}
	var harvests sync.WaitGroup
	harvests.Go(func() {
		for range concurrentHarvests {
			harvestLocked(meter)
		}
	})
	writers.Wait()
	harvests.Wait()
	harvestLocked(meter)

	counters := meter.counters[backendID]
	if counters.bytesIn != expectedWriterBytes || counters.bytesOut != expectedWriterBytes ||
		counters.packetsIn != concurrentWriters*writesPerWriter ||
		counters.tcpConnections != concurrentWriters {
		t.Fatalf("harvested counters = %+v, want every write counted exactly once", counters)
	}
	harvestLocked(meter)
	if remaining := liveCounters(meter); remaining != 0 {
		t.Fatalf("live counters = %d, want closed and drained counters forgotten", remaining)
	}
}

func TestHarvestKeepsClosedCounterUntilItsTrafficIsReported(t *testing.T) {
	meter := newTestMeter(t, &scriptedUsageAPI{}, newTestSession(time.Now()))
	counter := openAttributedCounter(meter, uuid.New(), testIdentity())
	counter.Close()
	counter.AddEgress(bytesPerWrite, 0)
	harvestLocked(meter)
	if liveCounters(meter) != 1 {
		t.Fatal("a closed counter with unreported traffic was forgotten")
	}
	harvestLocked(meter)
	if liveCounters(meter) != 0 {
		t.Fatal("a closed and drained counter was kept")
	}
}

func TestRotateKeepsHarvestedTrafficWhenTheIntervalCannotClose(t *testing.T) {
	now := time.Now()
	meter := newTestMeter(t, &scriptedUsageAPI{}, newTestSession(now))
	backendID := uuid.New()
	openAttributedCounter(meter, backendID, testIdentity()).AddIngress(bytesPerWrite, 0)
	if err := meter.rotate(meter.intervalStart); err != nil {
		t.Fatalf("rotate an empty window: %v", err)
	}
	if meter.counters[backendID].bytesIn != bytesPerWrite {
		t.Fatal("harvested traffic was lost when the interval could not close")
	}
}

func TestHarvestDropsBackendsBeyondTheIntervalLimit(t *testing.T) {
	meter := newTestMeter(t, &scriptedUsageAPI{}, newTestSession(time.Now()))
	for range maximumMeterRoutes + 1 {
		openAttributedCounter(meter, uuid.New(), testIdentity()).AddIngress(bytesPerWrite, 0)
	}
	harvestLocked(meter)
	if len(meter.counters) != maximumMeterRoutes || meter.Snapshot().DroppedRecords != 1 {
		t.Fatalf("metered %d backends with %d drops, want the limit and one drop",
			len(meter.counters), meter.Snapshot().DroppedRecords)
	}
}
