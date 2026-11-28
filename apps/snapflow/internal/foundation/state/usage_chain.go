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
)

type UsageChainKey struct {
	PlacementID  string
	GenerationID string
}

func (key UsageChainKey) validate() error {
	if strings.TrimSpace(key.PlacementID) == "" || strings.TrimSpace(key.GenerationID) == "" {
		return errors.New("usage chain requires a placement ID and a generation ID")
	}
	return nil
}

type UsageChainHead struct {
	Key       UsageChainKey
	Digest    string
	UpdatedAt time.Time
}

func (database *Database) LoadUsageChainHead(ctx context.Context, key UsageChainKey) (string, bool, error) {
	var digest string
	err := database.sql.QueryRowContext(
		ctx,
		"SELECT payload_digest FROM machine_usage_chain_head WHERE placement_id = ? AND generation_id = ?",
		key.PlacementID, key.GenerationID,
	).Scan(&digest)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("load usage chain head of placement %s: %w", key.PlacementID, err)
	}
	return digest, true, nil
}

func (database *Database) AcceptUsageReading(ctx context.Context, readingID int64, head UsageChainHead) error {
	if err := head.Key.validate(); err != nil {
		return err
	}
	operation := fmt.Sprintf("acceptance of usage reading %d", readingID)
	return database.inTransaction(ctx, operation, func(transaction *sql.Tx) error {
		if _, err := transaction.ExecContext(ctx, deleteUsageReadingStatement, readingID); err != nil {
			return fmt.Errorf("delete accepted usage reading %d: %w", readingID, err)
		}
		if _, err := transaction.ExecContext(
			ctx,
			`INSERT INTO machine_usage_chain_head (placement_id, generation_id, payload_digest, updated_at)
				VALUES (?, ?, ?, ?)
				ON CONFLICT (placement_id, generation_id)
				DO UPDATE SET payload_digest = excluded.payload_digest, updated_at = excluded.updated_at`,
			head.Key.PlacementID, head.Key.GenerationID, head.Digest, head.UpdatedAt.UnixMilli(),
		); err != nil {
			return fmt.Errorf("advance usage chain of placement %s: %w", head.Key.PlacementID, err)
		}
		return nil
	})
}

func (database *Database) PruneUsageChainHeads(ctx context.Context, cutoff time.Time) error {
	if _, err := database.sql.ExecContext(
		ctx, "DELETE FROM machine_usage_chain_head WHERE updated_at < ?", cutoff.UnixMilli(),
	); err != nil {
		return fmt.Errorf("prune usage chain heads: %w", err)
	}
	return nil
}
