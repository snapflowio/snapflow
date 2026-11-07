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
)

const schemaVersion = 2

func schemaStatements() []string {
	return []string{
		`CREATE TABLE machine_identity (
			singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
			api_url TEXT NOT NULL CHECK (length(trim(api_url)) > 0),
			machine_id TEXT NOT NULL CHECK (length(trim(machine_id)) > 0),
			owner_id TEXT NOT NULL CHECK (length(trim(owner_id)) > 0),
			identity_key_id TEXT NOT NULL CHECK (length(trim(identity_key_id)) > 0),
			key_backend TEXT NOT NULL CHECK (length(trim(key_backend)) > 0),
			key_reference TEXT NOT NULL CHECK (length(trim(key_reference)) > 0),
			updated_at TEXT NOT NULL
		) STRICT`,
		`CREATE TABLE machine_sandbox_convergence (
			sandbox_id TEXT PRIMARY KEY CHECK (length(sandbox_id) = 36),
			assignment_generation INTEGER NOT NULL CHECK (assignment_generation > 0),
			materialized INTEGER NOT NULL CHECK (materialized IN (0, 1)),
			observed_spec_generation INTEGER NOT NULL CHECK (observed_spec_generation >= 0),
			spec_digest TEXT NOT NULL,
			failure_reason TEXT NOT NULL,
			daemon_version TEXT NOT NULL,
			result TEXT,
			payment_held INTEGER NOT NULL CHECK (payment_held IN (0, 1)),
			updated_at TEXT NOT NULL
		) STRICT`,
		`CREATE TABLE machine_job_result (
			result_id INTEGER PRIMARY KEY AUTOINCREMENT,
			job_id TEXT NOT NULL UNIQUE CHECK (length(trim(job_id)) > 0),
			attempt INTEGER NOT NULL CHECK (attempt > 0),
			lease_token TEXT NOT NULL CHECK (length(lease_token) > 0),
			status_update TEXT NOT NULL
		) STRICT`,
		`CREATE TABLE machine_usage_reading (
			reading_id INTEGER PRIMARY KEY AUTOINCREMENT,
			sandbox_id TEXT NOT NULL CHECK (length(trim(sandbox_id)) > 0),
			assignment_generation INTEGER NOT NULL CHECK (assignment_generation > 0),
			sample TEXT NOT NULL
		) STRICT`,
		`CREATE TABLE machine_dead_letter (
			dead_letter_id INTEGER PRIMARY KEY AUTOINCREMENT,
			queue TEXT NOT NULL CHECK (queue IN ('job_result', 'usage_reading')),
			item_id TEXT NOT NULL CHECK (length(trim(item_id)) > 0),
			payload TEXT NOT NULL,
			reason TEXT NOT NULL,
			quarantined_at TEXT NOT NULL
		) STRICT`,
		`CREATE TABLE machine_snapshot (
			ref TEXT PRIMARY KEY CHECK (length(trim(ref)) > 0),
			digest TEXT NOT NULL,
			size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
			template TEXT,
			unwanted_since TEXT,
			updated_at TEXT NOT NULL
		) STRICT`,
		`CREATE TABLE machine_usage_chain_head (
			placement_id TEXT NOT NULL CHECK (length(trim(placement_id)) > 0),
			generation_id TEXT NOT NULL CHECK (length(trim(generation_id)) > 0),
			payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64),
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (placement_id, generation_id)
		) STRICT`,
		`CREATE TABLE machine_payment_channel (
			channel_id TEXT PRIMARY KEY CHECK (length(channel_id) = 66),
			sandbox_id TEXT NOT NULL CHECK (length(trim(sandbox_id)) > 0),
			lease_id TEXT NOT NULL CHECK (length(lease_id) = 36),
			state TEXT NOT NULL CHECK (state IN ('open', 'closing', 'closed')),
			voucher TEXT,
			domain TEXT,
			hold_window_ms INTEGER NOT NULL CHECK (hold_window_ms > 0),
			accepted_at INTEGER,
			held_at INTEGER,
			updated_at INTEGER NOT NULL,
			CHECK ((voucher IS NULL) = (domain IS NULL)),
			CHECK ((voucher IS NULL) = (accepted_at IS NULL))
		) STRICT`,
		`CREATE INDEX machine_payment_channel_sandbox ON machine_payment_channel (sandbox_id)`,
	}
}

func initializeSchema(ctx context.Context, connection *sql.DB) error {
	var version int
	if err := connection.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return fmt.Errorf("inspect Snapflow database schema version: %w", err)
	}
	switch version {
	case schemaVersion:
		return nil
	case 0:
		return createSchema(ctx, connection)
	default:
		return fmt.Errorf("the Snapflow database schema version %d is not supported (want %d); reset the machine state", version, schemaVersion)
	}
}

func createSchema(ctx context.Context, connection *sql.DB) (resultErr error) {
	transaction, err := connection.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin Snapflow database schema: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := transaction.Rollback(); rollbackErr != nil && !errors.Is(rollbackErr, sql.ErrTxDone) {
			resultErr = errors.Join(resultErr, fmt.Errorf("rollback Snapflow database schema: %w", rollbackErr))
		}
	}()
	for _, statement := range schemaStatements() {
		if _, err := transaction.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("create Snapflow database schema: %w", err)
		}
	}
	if _, err := transaction.ExecContext(ctx, fmt.Sprintf("PRAGMA user_version = %d", schemaVersion)); err != nil {
		return fmt.Errorf("record Snapflow database schema version: %w", err)
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit Snapflow database schema: %w", err)
	}
	committed = true
	return nil
}
