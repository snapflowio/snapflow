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
	"strings"
	"time"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
)

type SnapshotRecord struct {
	Ref           string
	Digest        string
	SizeBytes     int64
	Template      *machinev1alpha1.PreparedTemplate
	UnwantedSince time.Time
}

func (record SnapshotRecord) validate() error {
	if strings.TrimSpace(record.Ref) == "" {
		return errors.New("snapshot record requires a reference")
	}
	if record.SizeBytes < 0 {
		return fmt.Errorf("snapshot %s record has a negative size", record.Ref)
	}
	return nil
}

func (database *Database) SaveSnapshotRecord(ctx context.Context, record SnapshotRecord) error {
	if err := record.validate(); err != nil {
		return err
	}
	var template sql.NullString
	if record.Template != nil {
		encoded, err := protojson.Marshal(record.Template)
		if err != nil {
			return fmt.Errorf("encode snapshot %s template: %w", record.Ref, err)
		}
		template = sql.NullString{String: string(encoded), Valid: true}
	}
	var unwantedSince sql.NullString
	if !record.UnwantedSince.IsZero() {
		unwantedSince = sql.NullString{String: record.UnwantedSince.UTC().Format(time.RFC3339Nano), Valid: true}
	}
	if _, err := database.sql.ExecContext(
		ctx, `
		INSERT INTO machine_snapshot (ref, digest, size_bytes, template, unwanted_since, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(ref) DO UPDATE SET
			digest = excluded.digest,
			size_bytes = excluded.size_bytes,
			template = excluded.template,
			unwanted_since = excluded.unwanted_since,
			updated_at = excluded.updated_at
	`,
		record.Ref, record.Digest, record.SizeBytes, template, unwantedSince,
		time.Now().UTC().Format(time.RFC3339Nano),
	); err != nil {
		return fmt.Errorf("save snapshot %s record: %w", record.Ref, err)
	}
	return nil
}

func (database *Database) DeleteSnapshotRecord(ctx context.Context, ref string) error {
	if _, err := database.sql.ExecContext(ctx, "DELETE FROM machine_snapshot WHERE ref = ?", ref); err != nil {
		return fmt.Errorf("delete snapshot %s record: %w", ref, err)
	}
	return nil
}

func (database *Database) LoadSnapshotRecords(ctx context.Context) ([]SnapshotRecord, error) {
	return queryAll(ctx, database, "snapshot records", `
		SELECT ref, digest, size_bytes, template, unwanted_since FROM machine_snapshot ORDER BY ref
	`, scanSnapshotRecord)
}

func scanSnapshotRecord(rows *sql.Rows) (SnapshotRecord, error) {
	var (
		record        SnapshotRecord
		template      sql.NullString
		unwantedSince sql.NullString
	)
	if err := rows.Scan(&record.Ref, &record.Digest, &record.SizeBytes, &template, &unwantedSince); err != nil {
		return SnapshotRecord{}, fmt.Errorf("read snapshot record: %w", err)
	}
	if template.Valid {
		record.Template = &machinev1alpha1.PreparedTemplate{}
		if err := protojson.Unmarshal([]byte(template.String), record.Template); err != nil {
			return SnapshotRecord{}, fmt.Errorf("decode snapshot %s template: %w", record.Ref, err)
		}
	}
	if unwantedSince.Valid {
		parsed, err := time.Parse(time.RFC3339Nano, unwantedSince.String)
		if err != nil {
			return SnapshotRecord{}, fmt.Errorf("decode snapshot %s unwanted time: %w", record.Ref, err)
		}
		record.UnwantedSince = parsed
	}
	return record, nil
}
