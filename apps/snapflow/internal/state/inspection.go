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
	"net/url"
	"os"
	"path/filepath"
	"strconv"
)

type Inspection struct {
	Registered bool
	APIURL     string
	MachineID  string
	OwnerID    string
}

func Inspect(ctx context.Context, stateDirectory string) (inspection Inspection, resultErr error) {
	directory, err := resolveDirectory(stateDirectory)
	if err != nil {
		return Inspection{}, err
	}
	databasePath := filepath.Join(directory, databaseFilename)
	info, err := os.Stat(databasePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Inspection{}, ErrNotRegistered
		}
		return Inspection{}, fmt.Errorf("inspect Snapflow database: %w", err)
	}
	if !info.Mode().IsRegular() {
		return Inspection{}, errors.New("the Snapflow database is not a regular file")
	}
	databaseURL := url.URL{Scheme: "file", Path: filepath.ToSlash(databasePath)}
	query := databaseURL.Query()
	query.Set("mode", "ro")
	query.Set("_busy_timeout", strconv.Itoa(busyTimeoutMilliseconds))
	query.Set("_pragma", "query_only(1)")
	databaseURL.RawQuery = query.Encode()
	connection, err := sql.Open("sqlite", databaseURL.String())
	if err != nil {
		return Inspection{}, fmt.Errorf("open Snapflow database read-only: %w", err)
	}
	defer func() {
		if closeErr := connection.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close read-only Snapflow database: %w", closeErr))
		}
	}()
	err = connection.QueryRowContext(ctx, `
		SELECT api_url, machine_id, owner_id
		FROM machine_identity WHERE singleton_id = 1
	`).Scan(&inspection.APIURL, &inspection.MachineID, &inspection.OwnerID)
	if errors.Is(err, sql.ErrNoRows) {
		return Inspection{}, ErrNotRegistered
	}
	if err != nil {
		return Inspection{}, fmt.Errorf("inspect machine registration: %w", err)
	}
	inspection.Registered = true
	return inspection, nil
}
