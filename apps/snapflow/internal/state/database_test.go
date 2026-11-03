// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package state

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestOpenDatabaseAppliesCurrentSchemaAndProtectsState(t *testing.T) {
	stateDirectory := filepath.Join(t.TempDir(), "machine")
	database, err := OpenDatabase(context.Background(), stateDirectory)
	if err != nil {
		t.Fatalf("open Machine database: %v", err)
	}
	var version int
	if err := database.sql.QueryRowContext(t.Context(), "PRAGMA user_version").Scan(&version); err != nil {
		t.Fatalf("read schema version: %v", err)
	}
	if version != schemaVersion {
		t.Fatalf("schema version = %d, want %d", version, schemaVersion)
	}
	if err := database.Close(t.Context()); err != nil {
		t.Fatalf("close Machine database: %v", err)
	}
	for path, want := range map[string]os.FileMode{
		stateDirectory: directoryMode,
		filepath.Join(stateDirectory, databaseFilename): fileMode,
	} {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatalf("inspect %s: %v", path, err)
		}
		if got := info.Mode().Perm(); got != want {
			t.Fatalf("%s mode = %#o, want %#o", path, got, want)
		}
	}
}

func TestOpenDatabaseRejectsOtherSchemaVersions(t *testing.T) {
	stateDirectory := filepath.Join(t.TempDir(), "machine")
	database, err := OpenDatabase(context.Background(), stateDirectory)
	if err != nil {
		t.Fatalf("open Machine database: %v", err)
	}
	if _, err := database.sql.ExecContext(t.Context(), fmt.Sprintf("PRAGMA user_version = %d", schemaVersion+1)); err != nil {
		t.Fatalf("seed another schema version: %v", err)
	}
	if err := database.Close(t.Context()); err != nil {
		t.Fatalf("close Machine database: %v", err)
	}
	_, err = OpenDatabase(context.Background(), stateDirectory)
	if err == nil || !strings.Contains(err.Error(), "is not supported") {
		t.Fatalf("OpenDatabase error = %v", err)
	}
}
