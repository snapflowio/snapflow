// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"testing"
	"time"

	microvmtypes "github.com/snapflowio/microvm-go/types"
)

const (
	testUsageGeneration = 3
	testRunningMillis   = 650
)

func TestUsageReadingsPersistInOrderUntilDeleted(t *testing.T) {
	database := openTestDatabase(t)
	sampledAt := time.Date(2026, 10, 4, 16, 42, 48, 701_000_000, time.UTC)
	saveUsageSample(t, database, microvmtypes.RuntimeUsageSample{Sequence: 1, SampledAt: sampledAt})
	saveUsageSample(t, database, microvmtypes.RuntimeUsageSample{Sequence: 2, SampledAt: sampledAt.Add(time.Second), RunningMillis: testRunningMillis})
	loaded, quarantined, err := database.LoadUsageReadings(t.Context())
	if err != nil || len(loaded) != 2 || len(quarantined) != 0 {
		t.Fatalf("load readings = %v, %v", loaded, err)
	}
	if loaded[0].Sample.Sequence != 1 || loaded[1].Sample.Sequence != 2 || loaded[1].Sample.RunningMillis != testRunningMillis ||
		!loaded[0].Sample.SampledAt.Equal(sampledAt) || loaded[1].AssignmentGeneration != testUsageGeneration {
		t.Fatalf("loaded readings = %+v", loaded)
	}
	if err := database.DeleteUsageReading(t.Context(), loaded[0].ID); err != nil {
		t.Fatalf("delete reading: %v", err)
	}
	if loaded, quarantined, err := database.LoadUsageReadings(t.Context()); err != nil || len(quarantined) != 0 || len(loaded) != 1 || loaded[0].Sample.Sequence != 2 {
		t.Fatalf("readings after delete = %v, %v", loaded, err)
	}
}

func TestUsageReadingRequiresItsAssignment(t *testing.T) {
	database := openTestDatabase(t)
	if err := database.SaveUsageReading(t.Context(), UsageReading{
		SandboxID: testSandboxID, Sample: microvmtypes.RuntimeUsageSample{SampledAt: time.Now()},
	}); err == nil {
		t.Fatal("saved a reading without an assignment generation")
	}
}

func saveUsageSample(t *testing.T, database *Database, sample microvmtypes.RuntimeUsageSample) {
	t.Helper()
	if err := database.SaveUsageReading(t.Context(), UsageReading{
		SandboxID: testSandboxID, AssignmentGeneration: testUsageGeneration, Sample: sample,
	}); err != nil {
		t.Fatalf("save reading %d: %v", sample.Sequence, err)
	}
}
