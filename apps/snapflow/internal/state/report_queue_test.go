// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	microvmtypes "github.com/snapflowio/microvm-go/types"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	corruptPayload = "{not json"
	corruptJobID   = "job-corrupt"
)

func testLease() uuid.UUID {
	return uuid.MustParse("6f1c2a4e-9b3d-4c8e-8a71-2d5f0e9b4c13")
}

func testJobResult(jobID string, attempt int32) JobResult {
	return JobResult{JobID: jobID, Update: apiclient.UpdateJobStatus{Status: apiclient.JobStatusCompleted, LeaseToken: testLease(), Attempt: attempt}}
}

func saveJobResults(t *testing.T, database *Database, results ...JobResult) {
	t.Helper()
	for _, result := range results {
		if err := database.SaveJobResult(t.Context(), result); err != nil {
			t.Fatalf("save result of %s: %v", result.JobID, err)
		}
	}
}

func jobIDs(results []JobResult) []string {
	ids := make([]string, 0, len(results))
	for _, result := range results {
		ids = append(ids, result.JobID)
	}
	return ids
}

func deadLetterCount(t *testing.T, database *Database, queue string) int {
	t.Helper()
	var count int
	if err := database.sql.QueryRowContext(
		t.Context(),
		"SELECT count(*) FROM machine_dead_letter WHERE queue = ? AND payload = ? AND length(reason) > 0 AND length(quarantined_at) > 0",
		queue, corruptPayload,
	).Scan(&count); err != nil {
		t.Fatalf("count dead letters: %v", err)
	}
	return count
}

func TestACorruptJobResultIsQuarantinedWithoutBlockingTheQueue(t *testing.T) {
	database := openTestDatabase(t)
	saveJobResults(t, database, testJobResult("job-a", 1))
	if _, err := database.sql.ExecContext(
		t.Context(),
		"INSERT INTO machine_job_result (job_id, attempt, lease_token, status_update) VALUES (?, 1, ?, ?)",
		corruptJobID, testLease(), corruptPayload,
	); err != nil {
		t.Fatalf("seed corrupt result: %v", err)
	}
	saveJobResults(t, database, testJobResult("job-c", 1))

	results, quarantined, err := database.LoadJobResults(t.Context())
	if err != nil {
		t.Fatalf("LoadJobResults() error = %v", err)
	}
	if got := jobIDs(results); !slices.Equal(got, []string{"job-a", "job-c"}) {
		t.Fatalf("delivered results = %v", got)
	}
	if len(quarantined) != 1 || quarantined[0].ItemID != corruptJobID || quarantined[0].Queue != DeadLetterQueueJobResult {
		t.Fatalf("quarantined = %+v", quarantined)
	}
	if deadLetterCount(t, database, DeadLetterQueueJobResult) != 1 {
		t.Fatal("the corrupt result was not kept as a dead letter")
	}
	if results, quarantined, err := database.LoadJobResults(t.Context()); err != nil || len(results) != 2 || len(quarantined) != 0 {
		t.Fatalf("reload = %v, %v, %v; want the corrupt row gone from the queue", results, quarantined, err)
	}
}

func TestLookingUpACorruptJobResultQuarantinesIt(t *testing.T) {
	database := openTestDatabase(t)
	if _, err := database.sql.ExecContext(
		t.Context(),
		"INSERT INTO machine_job_result (job_id, attempt, lease_token, status_update) VALUES (?, 1, ?, ?)",
		corruptJobID, testLease(), corruptPayload,
	); err != nil {
		t.Fatalf("seed corrupt result: %v", err)
	}
	result, found, err := database.LoadJobResult(t.Context(), corruptJobID)
	var quarantined *QuarantinedError
	if !errors.As(err, &quarantined) || found || result.JobID != "" || quarantined.DeadLetter.ItemID != corruptJobID {
		t.Fatalf("LoadJobResult() = %+v, %v, %v", result, found, err)
	}
	if result, found, err := database.LoadJobResult(t.Context(), corruptJobID); err != nil || found {
		t.Fatalf("lookup after quarantine = %+v, %v, %v", result, found, err)
	}
}

func TestACorruptUsageReadingIsQuarantinedWithoutBlockingTheQueue(t *testing.T) {
	database := openTestDatabase(t)
	sampledAt := time.Date(2026, 10, 4, 16, 42, 48, 0, time.UTC)
	save := func(sequence uint64) {
		if err := database.SaveUsageReading(t.Context(), UsageReading{
			SandboxID: testSandboxID, AssignmentGeneration: testUsageGeneration,
			Sample: microvmtypes.RuntimeUsageSample{Sequence: sequence, SampledAt: sampledAt.Add(time.Duration(sequence) * time.Second)},
		}); err != nil {
			t.Fatalf("save reading %d: %v", sequence, err)
		}
	}
	save(1)
	if _, err := database.sql.ExecContext(
		t.Context(),
		"INSERT INTO machine_usage_reading (sandbox_id, assignment_generation, sample) VALUES (?, ?, ?)",
		testSandboxID, testUsageGeneration, corruptPayload,
	); err != nil {
		t.Fatalf("seed corrupt reading: %v", err)
	}
	save(2)

	readings, quarantined, err := database.LoadUsageReadings(t.Context())
	if err != nil {
		t.Fatalf("LoadUsageReadings() error = %v", err)
	}
	if len(readings) != 2 || readings[0].Sample.Sequence != 1 || readings[1].Sample.Sequence != 2 {
		t.Fatalf("delivered readings = %+v", readings)
	}
	if len(quarantined) != 1 || quarantined[0].Queue != DeadLetterQueueUsageReading {
		t.Fatalf("quarantined = %+v", quarantined)
	}
	if deadLetterCount(t, database, DeadLetterQueueUsageReading) != 1 {
		t.Fatal("the corrupt reading was not kept as a dead letter")
	}
}

func TestJobResultsQueueInTheOrderTheyAreRecorded(t *testing.T) {
	database := openTestDatabase(t)
	saveJobResults(t, database, testJobResult("job-b", 1), testJobResult("job-a", 1), testJobResult("job-c", 1))
	saveJobResults(t, database, testJobResult("job-b", 2))
	results, quarantined, err := database.LoadJobResults(t.Context())
	if err != nil || len(quarantined) != 0 {
		t.Fatalf("LoadJobResults() = %v, %v", quarantined, err)
	}
	if got := jobIDs(results); !slices.Equal(got, []string{"job-a", "job-c", "job-b"}) {
		t.Fatalf("delivery order = %v", got)
	}
}
