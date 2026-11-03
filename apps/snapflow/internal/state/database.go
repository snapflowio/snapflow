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
	"strings"
	"time"

	moderncsqlite "modernc.org/sqlite"
)

const (
	databaseFilename        = "machine.db"
	directoryMode           = 0o700
	fileMode                = 0o600
	busyTimeoutMilliseconds = 5_000
	sqliteSynchronousFull   = 2
	databaseCloseTimeout    = 10 * time.Second
	integrityCheckPassed    = "ok"
)

type Database struct {
	sql      *sql.DB
	readOnly bool
}

func OpenDatabase(ctx context.Context, stateDirectory string) (*Database, error) {
	if ctx == nil {
		return nil, errors.New("the Snapflow database context is required")
	}
	if !filepath.IsAbs(stateDirectory) {
		return nil, errors.New("the Snapflow state directory must be absolute")
	}
	stateDirectory = filepath.Clean(stateDirectory)
	if err := os.MkdirAll(stateDirectory, directoryMode); err != nil {
		return nil, fmt.Errorf("create Snapflow state directory: %w", err)
	}
	if err := os.Chmod(stateDirectory, directoryMode); err != nil {
		return nil, fmt.Errorf("protect Snapflow state directory: %w", err)
	}
	path := filepath.Join(stateDirectory, databaseFilename)
	connector, err := moderncsqlite.NewConnector(sqliteDataSourceName(path))
	if err != nil {
		return nil, fmt.Errorf("configure Snapflow database: %w", err)
	}
	connection := sql.OpenDB(connector)
	connection.SetMaxOpenConns(1)
	connection.SetMaxIdleConns(1)
	connection.SetConnMaxLifetime(0)
	database := &Database{sql: connection}
	if err := database.initialize(ctx, path); err != nil {
		if closeErr := connection.Close(); closeErr != nil {
			return nil, errors.Join(err, fmt.Errorf("close failed Snapflow database: %w", closeErr))
		}
		return nil, err
	}
	return database, nil
}

func openDatabaseReadOnly(ctx context.Context, stateDirectory string) (*Database, error) {
	if ctx == nil {
		return nil, errors.New("the Snapflow database context is required")
	}
	directory, err := resolveDirectory(stateDirectory)
	if err != nil {
		return nil, err
	}
	path := filepath.Join(directory, databaseFilename)
	info, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, ErrNotRegistered
		}
		return nil, fmt.Errorf("inspect Snapflow database: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("the Snapflow database is not a regular file")
	}
	connector, err := moderncsqlite.NewConnector(readOnlySQLiteDataSourceName(path))
	if err != nil {
		return nil, fmt.Errorf("configure read-only Snapflow database: %w", err)
	}
	connection := sql.OpenDB(connector)
	connection.SetMaxOpenConns(1)
	connection.SetMaxIdleConns(1)
	connection.SetConnMaxLifetime(0)
	if err := connection.PingContext(ctx); err != nil {
		if closeErr := connection.Close(); closeErr != nil {
			return nil, errors.Join(
				fmt.Errorf("connect to read-only Snapflow database: %w", err),
				fmt.Errorf("close failed read-only Snapflow database: %w", closeErr),
			)
		}
		return nil, fmt.Errorf("connect to read-only Snapflow database: %w", err)
	}
	return &Database{sql: connection, readOnly: true}, nil
}

func (database *Database) Close(ctx context.Context) error {
	if database == nil || database.sql == nil {
		return nil
	}
	var checkpointErr error
	if !database.readOnly {
		checkpointContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), databaseCloseTimeout)
		defer cancel()
		if _, err := database.sql.ExecContext(checkpointContext, "PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
			checkpointErr = fmt.Errorf("checkpoint Snapflow database WAL: %w", err)
		}
	}
	var closeErr error
	if err := database.sql.Close(); err != nil {
		closeErr = fmt.Errorf("close Snapflow database: %w", err)
	}
	return errors.Join(checkpointErr, closeErr)
}

func (database *Database) initialize(ctx context.Context, path string) error {
	if err := database.sql.PingContext(ctx); err != nil {
		return fmt.Errorf("connect to Snapflow database: %w", err)
	}
	if err := checkDatabasePragmas(ctx, database.sql); err != nil {
		return err
	}
	if err := os.Chmod(path, fileMode); err != nil {
		return fmt.Errorf("protect Snapflow database: %w", err)
	}
	if err := checkDatabaseIntegrity(ctx, database.sql); err != nil {
		return err
	}
	if err := initializeSchema(ctx, database.sql); err != nil {
		return err
	}
	if err := checkDatabaseIntegrity(ctx, database.sql); err != nil {
		return err
	}
	return checkDatabaseForeignKeys(ctx, database.sql)
}

func sqliteDataSourceName(path string) string {
	databaseURL := url.URL{Scheme: "file", Path: filepath.ToSlash(filepath.Clean(path))}
	parameters := databaseURL.Query()
	parameters.Set("_busy_timeout", strconv.Itoa(busyTimeoutMilliseconds))
	parameters.Set("_defensive", "true")
	parameters.Set("_dqs", "false")
	parameters.Set("_foreign_keys", "true")
	parameters.Set("_journal_mode", "WAL")
	parameters.Set("_synchronous", "FULL")
	databaseURL.RawQuery = parameters.Encode()
	return databaseURL.String()
}

func readOnlySQLiteDataSourceName(path string) string {
	databaseURL := url.URL{Scheme: "file", Path: filepath.ToSlash(filepath.Clean(path))}
	parameters := databaseURL.Query()
	parameters.Set("mode", "ro")
	parameters.Set("_busy_timeout", strconv.Itoa(busyTimeoutMilliseconds))
	parameters.Set("_defensive", "true")
	parameters.Set("_dqs", "false")
	parameters.Set("_foreign_keys", "true")
	parameters.Set("_pragma", "query_only(1)")
	databaseURL.RawQuery = parameters.Encode()
	return databaseURL.String()
}

func checkDatabasePragmas(ctx context.Context, connection *sql.DB) error {
	var journalMode string
	if err := connection.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&journalMode); err != nil {
		return fmt.Errorf("inspect Snapflow database journal mode: %w", err)
	}
	if !strings.EqualFold(journalMode, "wal") {
		return fmt.Errorf("enable Snapflow database WAL: SQLite selected %q", journalMode)
	}
	checks := []struct {
		name     string
		expected int
	}{
		{name: "foreign_keys", expected: 1},
		{name: "synchronous", expected: sqliteSynchronousFull},
		{name: "busy_timeout", expected: busyTimeoutMilliseconds},
	}
	for _, check := range checks {
		var actual int
		if err := connection.QueryRowContext(ctx, "PRAGMA "+check.name).Scan(&actual); err != nil {
			return fmt.Errorf("inspect Snapflow database %s pragma: %w", check.name, err)
		}
		if actual != check.expected {
			return fmt.Errorf("the Snapflow database %s pragma is %d; expected %d", check.name, actual, check.expected)
		}
	}
	return nil
}

func checkDatabaseIntegrity(ctx context.Context, connection *sql.DB) error {
	var result string
	if err := connection.QueryRowContext(ctx, "PRAGMA quick_check").Scan(&result); err != nil {
		return fmt.Errorf("check Snapflow database integrity: %w", err)
	}
	if result != integrityCheckPassed {
		return fmt.Errorf("the Snapflow database integrity check failed: %s", result)
	}
	return nil
}

func checkDatabaseForeignKeys(ctx context.Context, connection *sql.DB) (resultErr error) {
	rows, err := connection.QueryContext(ctx, "PRAGMA foreign_key_check")
	if err != nil {
		return fmt.Errorf("check Snapflow database foreign keys: %w", err)
	}
	defer func() {
		if closeErr := rows.Close(); closeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close machine foreign-key check: %w", closeErr))
		}
	}()
	if rows.Next() {
		var table string
		var rowID sql.NullInt64
		var parent string
		var foreignKeyID int
		if err := rows.Scan(&table, &rowID, &parent, &foreignKeyID); err != nil {
			return fmt.Errorf("read Snapflow database foreign-key violation: %w", err)
		}
		return fmt.Errorf("the Snapflow database foreign-key check failed for table %s row %v parent %s constraint %d", table, rowID, parent, foreignKeyID)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate Snapflow database foreign-key check: %w", err)
	}
	return nil
}
