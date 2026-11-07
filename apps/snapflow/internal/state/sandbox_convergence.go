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
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
)

type SandboxConvergence struct {
	SandboxID              string
	AssignmentGeneration   uint32
	Materialized           bool
	ObservedSpecGeneration uint32
	SpecDigest             string
	FailureReason          string
	DaemonVersion          string
	Result                 *machinev1alpha1.ConvergenceResult
	// PaymentHeld records whether the last successful convergence applied a
	// payment hold, so a hold or release that has not taken effect yet makes
	// the sandbox pending again.
	PaymentHeld bool
}

func (record SandboxConvergence) validate() error {
	if err := uuid.Validate(record.SandboxID); err != nil {
		return fmt.Errorf("sandbox convergence record requires a sandbox UUID: %w", err)
	}
	if record.AssignmentGeneration == 0 {
		return errors.New("sandbox convergence record requires an assignment generation")
	}
	return nil
}

func (database *Database) SaveSandboxConvergence(ctx context.Context, record SandboxConvergence) error {
	if err := record.validate(); err != nil {
		return err
	}
	var result sql.NullString
	if record.Result != nil {
		encoded, err := protojson.Marshal(record.Result)
		if err != nil {
			return fmt.Errorf("encode sandbox %s convergence result: %w", record.SandboxID, err)
		}
		result = sql.NullString{String: string(encoded), Valid: true}
	}
	if _, err := database.sql.ExecContext(
		ctx, `
		INSERT INTO machine_sandbox_convergence (
			sandbox_id, assignment_generation, materialized, observed_spec_generation,
			spec_digest, failure_reason, daemon_version, result, payment_held, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(sandbox_id) DO UPDATE SET
			assignment_generation = excluded.assignment_generation,
			materialized = excluded.materialized,
			observed_spec_generation = excluded.observed_spec_generation,
			spec_digest = excluded.spec_digest,
			failure_reason = excluded.failure_reason,
			daemon_version = excluded.daemon_version,
			result = excluded.result,
			payment_held = excluded.payment_held,
			updated_at = excluded.updated_at
	`,
		record.SandboxID, int64(record.AssignmentGeneration), record.Materialized,
		int64(record.ObservedSpecGeneration), record.SpecDigest, record.FailureReason,
		record.DaemonVersion, result, record.PaymentHeld, time.Now().UTC().Format(time.RFC3339Nano),
	); err != nil {
		return fmt.Errorf("save sandbox %s convergence record: %w", record.SandboxID, err)
	}
	return nil
}

func (database *Database) DeleteSandboxConvergence(ctx context.Context, sandboxID string) error {
	if _, err := database.sql.ExecContext(ctx, "DELETE FROM machine_sandbox_convergence WHERE sandbox_id = ?", sandboxID); err != nil {
		return fmt.Errorf("delete sandbox %s convergence record: %w", sandboxID, err)
	}
	return nil
}

func (database *Database) LoadSandboxConvergences(ctx context.Context) ([]SandboxConvergence, error) {
	return queryAll(ctx, database, "sandbox convergence records", `
		SELECT sandbox_id, assignment_generation, materialized, observed_spec_generation,
			spec_digest, failure_reason, daemon_version, result, payment_held
		FROM machine_sandbox_convergence ORDER BY sandbox_id
	`, scanSandboxConvergence)
}

func scanSandboxConvergence(rows *sql.Rows) (SandboxConvergence, error) {
	var (
		record                 SandboxConvergence
		assignmentGeneration   int64
		observedSpecGeneration int64
		result                 sql.NullString
	)
	if err := rows.Scan(
		&record.SandboxID, &assignmentGeneration, &record.Materialized, &observedSpecGeneration,
		&record.SpecDigest, &record.FailureReason, &record.DaemonVersion, &result, &record.PaymentHeld,
	); err != nil {
		return SandboxConvergence{}, fmt.Errorf("read sandbox convergence record: %w", err)
	}
	record.AssignmentGeneration = uint32(assignmentGeneration)
	record.ObservedSpecGeneration = uint32(observedSpecGeneration)
	if result.Valid {
		record.Result = &machinev1alpha1.ConvergenceResult{}
		if err := protojson.Unmarshal([]byte(result.String), record.Result); err != nil {
			return SandboxConvergence{}, fmt.Errorf("decode sandbox %s convergence result: %w", record.SandboxID, err)
		}
	}
	return record, nil
}
