// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"path/filepath"
	"testing"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	testSandboxID = "7b0c6f63-3c71-4b6e-9a0d-2f4f6d1c8e01"
	testJobID     = "job-1"
	testErrorCode = machinev1alpha1.MachineErrorCode_MACHINE_ERROR_CODE_NONE
)

func openTestDatabase(t *testing.T) *Database {
	t.Helper()
	database, err := OpenDatabase(t.Context(), filepath.Join(t.TempDir(), "machine"))
	if err != nil {
		t.Fatalf("open Machine database: %v", err)
	}
	t.Cleanup(func() {
		if err := database.Close(t.Context()); err != nil {
			t.Errorf("close Machine database: %v", err)
		}
	})
	return database
}

func TestSandboxConvergenceRecordsRoundTrip(t *testing.T) {
	database := openTestDatabase(t)
	record := SandboxConvergence{
		SandboxID: testSandboxID, AssignmentGeneration: 2, Materialized: true, ObservedSpecGeneration: 5,
		SpecDigest: "digest", DaemonVersion: "1.4.2", PaymentHeld: true,
		Result: &machinev1alpha1.ConvergenceResult{ErrorCode: testErrorCode},
	}
	if err := database.SaveSandboxConvergence(t.Context(), record); err != nil {
		t.Fatalf("save record: %v", err)
	}
	loaded, err := database.LoadSandboxConvergences(t.Context())
	if err != nil || len(loaded) != 1 {
		t.Fatalf("load records = %v, %v", loaded, err)
	}
	if got := loaded[0]; got.ObservedSpecGeneration != 5 || !got.Materialized || !got.PaymentHeld || got.Result.GetErrorCode() != testErrorCode {
		t.Fatalf("loaded record = %+v", got)
	}
	if err := database.DeleteSandboxConvergence(t.Context(), testSandboxID); err != nil {
		t.Fatalf("delete record: %v", err)
	}
	if loaded, err := database.LoadSandboxConvergences(t.Context()); err != nil || len(loaded) != 0 {
		t.Fatalf("records after delete = %v, %v", loaded, err)
	}
}

func TestJobResultsPersistUntilTheirAttemptIsDeleted(t *testing.T) {
	database := openTestDatabase(t)
	first := JobResult{JobID: testJobID, Update: apiclient.UpdateJobStatus{Status: apiclient.JobStatusCompleted, LeaseToken: testLease(), Attempt: 1}}
	if err := database.SaveJobResult(t.Context(), first); err != nil {
		t.Fatalf("save result: %v", err)
	}
	second := first
	second.Update.Attempt = 2
	if err := database.SaveJobResult(t.Context(), second); err != nil {
		t.Fatalf("save newer attempt: %v", err)
	}
	if err := database.DeleteJobResult(t.Context(), first); err != nil {
		t.Fatalf("delete older attempt: %v", err)
	}
	loaded, found, err := database.LoadJobResult(t.Context(), testJobID)
	if err != nil || !found || !loaded.Matches(testLease(), 2) {
		t.Fatalf("pending result = %+v, %v, %v", loaded, found, err)
	}
	if err := database.DeleteJobResult(t.Context(), second); err != nil {
		t.Fatalf("delete result: %v", err)
	}
	if pending, quarantined, err := database.LoadJobResults(t.Context()); err != nil || len(pending) != 0 || len(quarantined) != 0 {
		t.Fatalf("pending results = %v, %v", pending, err)
	}
}
