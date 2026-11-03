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
	"strconv"
	"strings"

	microvmtypes "github.com/snapflowio/microvm-go/types"
)

type UsageReading struct {
	ID                   int64
	SandboxID            string
	AssignmentGeneration uint32
	Sample               microvmtypes.RuntimeUsageSample
}

func (reading UsageReading) validate() error {
	if strings.TrimSpace(reading.SandboxID) == "" {
		return errors.New("usage reading requires a sandbox ID")
	}
	if reading.AssignmentGeneration == 0 {
		return fmt.Errorf("usage reading of sandbox %s requires an assignment generation", reading.SandboxID)
	}
	if reading.Sample.SampledAt.IsZero() {
		return fmt.Errorf("usage reading of sandbox %s requires a sample time", reading.SandboxID)
	}
	return nil
}

const deleteUsageReadingStatement = "DELETE FROM machine_usage_reading WHERE reading_id = ?"

func (database *Database) SaveUsageReading(ctx context.Context, reading UsageReading) error {
	if err := reading.validate(); err != nil {
		return err
	}
	encoded, err := json.Marshal(reading.Sample)
	if err != nil {
		return fmt.Errorf("encode usage reading of sandbox %s: %w", reading.SandboxID, err)
	}
	if _, err := database.sql.ExecContext(
		ctx,
		"INSERT INTO machine_usage_reading (sandbox_id, assignment_generation, sample) VALUES (?, ?, ?)",
		reading.SandboxID, int64(reading.AssignmentGeneration), string(encoded),
	); err != nil {
		return fmt.Errorf("save usage reading of sandbox %s: %w", reading.SandboxID, err)
	}
	return nil
}

func (database *Database) DeleteUsageReading(ctx context.Context, id int64) error {
	if _, err := database.sql.ExecContext(ctx, deleteUsageReadingStatement, id); err != nil {
		return fmt.Errorf("delete usage reading %d: %w", id, err)
	}
	return nil
}

func (database *Database) LoadUsageReadings(ctx context.Context) ([]UsageReading, []DeadLetter, error) {
	rows, err := database.loadUsageReadingRows(ctx)
	if err != nil {
		return nil, nil, err
	}
	return decodeQueue(ctx, database, DeadLetterQueueUsageReading, deleteUsageReadingStatement, rows,
		func(row usageReadingRow) (UsageReading, error) {
			reading := UsageReading{ID: row.id, SandboxID: row.sandboxID, AssignmentGeneration: uint32(row.assignmentGeneration)}
			if err := json.Unmarshal([]byte(row.sample), &reading.Sample); err != nil {
				return UsageReading{}, fmt.Errorf("decode usage reading %d: %w", row.id, err)
			}
			return reading, reading.validate()
		})
}

func (database *Database) loadUsageReadingRows(ctx context.Context) ([]usageReadingRow, error) {
	return queryAll(ctx, database, "pending usage readings",
		"SELECT reading_id, sandbox_id, assignment_generation, sample FROM machine_usage_reading ORDER BY reading_id",
		func(rows *sql.Rows) (usageReadingRow, error) {
			var row usageReadingRow
			if err := rows.Scan(&row.id, &row.sandboxID, &row.assignmentGeneration, &row.sample); err != nil {
				return usageReadingRow{}, fmt.Errorf("read pending usage reading: %w", err)
			}
			return row, nil
		})
}

type usageReadingRow struct {
	id                   int64
	sandboxID            string
	assignmentGeneration int64
	sample               string
}

func (row usageReadingRow) item() (itemID string, key any, payload string) {
	return strconv.FormatInt(row.id, 10), row.id, row.sample
}
