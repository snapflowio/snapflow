// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const deleteJobResultStatement = "DELETE FROM machine_job_result WHERE job_id = ?"

type JobResult struct {
	JobID  string
	Update apiclient.UpdateJobStatus
}

func (result JobResult) validate() error {
	if strings.TrimSpace(result.JobID) == "" {
		return errors.New("job result requires a job ID")
	}
	if result.Update.LeaseToken == uuid.Nil || result.Update.Attempt < 1 {
		return fmt.Errorf("job %s result requires its lease token and attempt", result.JobID)
	}
	return nil
}

func (result JobResult) Matches(leaseToken uuid.UUID, attempt int32) bool {
	return result.Update.LeaseToken == leaseToken && result.Update.Attempt == attempt
}

func (database *Database) SaveJobResult(ctx context.Context, result JobResult) error {
	if err := result.validate(); err != nil {
		return err
	}
	encoded, err := json.Marshal(result.Update)
	if err != nil {
		return fmt.Errorf("encode job %s result: %w", result.JobID, err)
	}
	if _, err := database.sql.ExecContext(
		ctx,
		"INSERT OR REPLACE INTO machine_job_result (job_id, attempt, lease_token, status_update) VALUES (?, ?, ?, ?)",
		result.JobID, result.Update.Attempt, result.Update.LeaseToken, string(encoded),
	); err != nil {
		return fmt.Errorf("save job %s result: %w", result.JobID, err)
	}
	return nil
}

func (database *Database) DeleteJobResult(ctx context.Context, result JobResult) error {
	if _, err := database.sql.ExecContext(
		ctx,
		"DELETE FROM machine_job_result WHERE job_id = ? AND attempt = ? AND lease_token = ?",
		result.JobID, result.Update.Attempt, result.Update.LeaseToken,
	); err != nil {
		return fmt.Errorf("delete job %s result: %w", result.JobID, err)
	}
	return nil
}

func (database *Database) LoadJobResult(ctx context.Context, jobID string) (JobResult, bool, error) {
	var encoded string
	err := database.sql.QueryRowContext(ctx, "SELECT status_update FROM machine_job_result WHERE job_id = ?", jobID).Scan(&encoded)
	if errors.Is(err, sql.ErrNoRows) {
		return JobResult{}, false, nil
	}
	if err != nil {
		return JobResult{}, false, fmt.Errorf("load job %s result: %w", jobID, err)
	}
	results, quarantined, err := database.decodeJobResults(ctx, []jobResultRow{{jobID: jobID, encoded: encoded}})
	if err != nil {
		return JobResult{}, false, err
	}
	if len(quarantined) > 0 {
		return JobResult{}, false, &QuarantinedError{DeadLetter: quarantined[0]}
	}
	return results[0], true, nil
}

func (database *Database) LoadJobResults(ctx context.Context) ([]JobResult, []DeadLetter, error) {
	rows, err := database.loadJobResultRows(ctx)
	if err != nil {
		return nil, nil, err
	}
	return database.decodeJobResults(ctx, rows)
}

func (database *Database) loadJobResultRows(ctx context.Context) ([]jobResultRow, error) {
	return queryAll(ctx, database, "pending job results",
		"SELECT job_id, status_update FROM machine_job_result ORDER BY result_id",
		func(rows *sql.Rows) (jobResultRow, error) {
			var row jobResultRow
			if err := rows.Scan(&row.jobID, &row.encoded); err != nil {
				return jobResultRow{}, fmt.Errorf("read pending job result: %w", err)
			}
			return row, nil
		})
}

func (database *Database) decodeJobResults(ctx context.Context, rows []jobResultRow) ([]JobResult, []DeadLetter, error) {
	return decodeQueue(ctx, database, DeadLetterQueueJobResult, deleteJobResultStatement, rows,
		func(row jobResultRow) (JobResult, error) {
			result := JobResult{JobID: row.jobID}
			if err := json.Unmarshal([]byte(row.encoded), &result.Update); err != nil {
				return JobResult{}, fmt.Errorf("decode job %s result: %w", row.jobID, err)
			}
			return result, result.validate()
		})
}

type jobResultRow struct {
	jobID   string
	encoded string
}

func (row jobResultRow) item() (itemID string, key any, payload string) {
	return row.jobID, row.jobID, row.encoded
}
