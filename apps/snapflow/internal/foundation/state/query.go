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

func queryAll[T any](
	ctx context.Context,
	database *Database,
	description, query string,
	scan func(*sql.Rows) (T, error),
) (records []T, resultErr error) {
	rows, err := database.sql.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("load %s: %w", description, err)
	}
	defer func() {
		if closeErr := rows.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close %s: %w", description, closeErr))
		}
	}()
	for rows.Next() {
		record, err := scan(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate %s: %w", description, err)
	}
	return records, nil
}
