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

func (database *Database) inTransaction(ctx context.Context, operation string, work func(*sql.Tx) error) (resultErr error) {
	transaction, err := database.sql.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin %s: %w", operation, err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := transaction.Rollback(); rollbackErr != nil && !errors.Is(rollbackErr, sql.ErrTxDone) {
			resultErr = errors.Join(resultErr, fmt.Errorf("roll back %s: %w", operation, rollbackErr))
		}
	}()
	if err := work(transaction); err != nil {
		return err
	}
	if err := transaction.Commit(); err != nil {
		return fmt.Errorf("commit %s: %w", operation, err)
	}
	committed = true
	return nil
}
