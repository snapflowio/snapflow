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
	"fmt"
	"log/slog"
	"time"
)

const (
	DeadLetterQueueJobResult    = "job_result"
	DeadLetterQueueUsageReading = "usage_reading"
)

type DeadLetter struct {
	Queue  string
	ItemID string
	Reason string
}

type QuarantinedError struct {
	DeadLetter DeadLetter
}

func (err *QuarantinedError) Error() string {
	return fmt.Sprintf("quarantined undecodable %s %s: %s", err.DeadLetter.Queue, err.DeadLetter.ItemID, err.DeadLetter.Reason)
}

type queuedRow interface {
	item() (itemID string, key any, payload string)
}

func decodeQueue[R queuedRow, T any](
	ctx context.Context,
	database *Database,
	queue string,
	deleteStatement string,
	rows []R,
	decode func(R) (T, error),
) ([]T, []DeadLetter, error) {
	items := make([]T, 0, len(rows))
	var quarantined []DeadLetter
	for _, row := range rows {
		decoded, err := decode(row)
		if err == nil {
			items = append(items, decoded)
			continue
		}
		itemID, key, payload := row.item()
		letter := DeadLetter{Queue: queue, ItemID: itemID, Reason: err.Error()}
		if err := database.quarantine(ctx, letter, key, payload, deleteStatement); err != nil {
			return nil, nil, err
		}
		quarantined = append(quarantined, letter)
	}
	return items, quarantined, nil
}

func (database *Database) quarantine(ctx context.Context, letter DeadLetter, key any, payload, deleteStatement string) error {
	operation := fmt.Sprintf("quarantine of %s %s", letter.Queue, letter.ItemID)
	return database.inTransaction(ctx, operation, func(transaction *sql.Tx) error {
		if _, err := transaction.ExecContext(
			ctx,
			"INSERT INTO machine_dead_letter (queue, item_id, payload, reason, quarantined_at) VALUES (?, ?, ?, ?, ?)",
			letter.Queue, letter.ItemID, payload, letter.Reason, time.Now().UTC().Format(time.RFC3339Nano),
		); err != nil {
			return fmt.Errorf("record dead letter for %s %s: %w", letter.Queue, letter.ItemID, err)
		}
		if _, err := transaction.ExecContext(ctx, deleteStatement, key); err != nil {
			return fmt.Errorf("remove quarantined %s %s: %w", letter.Queue, letter.ItemID, err)
		}
		return nil
	})
}

func LogDeadLetters(ctx context.Context, log *slog.Logger, letters []DeadLetter) {
	for _, letter := range letters {
		log.ErrorContext(ctx, "Quarantined an undecodable queued report",
			"queue", letter.Queue, "item_id", letter.ItemID, "reason", letter.Reason)
	}
}
