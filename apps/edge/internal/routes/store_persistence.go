// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/snapflowio/edge/internal/statefile"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	routeTableFilename         = "route-table.json"
	minimumPersistenceInterval = 60 * time.Second
)

var ErrInvalidPersistedTable = errors.New(
	"persisted route table is invalid",
)

func (store *Store) persist(
	table *apiclient.EdgeRouteSnapshotDto,
	version string,
	now time.Time,
) {
	if !store.shouldPersist(version, now) {
		return
	}
	if err := statefile.WriteJSON(store.path, table); err != nil {
		store.logger.Warn(
			"could not persist last-known-good route table",
			"path",
			store.path,
			"error",
			err,
		)
		return
	}
	store.persistedAt = now
	store.persistedVersion = version
}

func (store *Store) shouldPersist(version string, now time.Time) bool {
	return store.persistedAt.IsZero() ||
		store.persistedVersion != version ||
		now.Sub(store.persistedAt) >= minimumPersistenceInterval
}

func loadSnapshot(
	path string,
	edgeID string,
	sessionGeneration int32,
) (*Snapshot, time.Time, error) {
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return emptySnapshot(), time.Time{}, nil
	}
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("read last-known-good route table: %w", err)
	}
	table, err := DecodeSnapshot(payload)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf(
			"%w: decode last-known-good route table: %w",
			ErrInvalidPersistedTable,
			err,
		)
	}
	snapshot, err := Parse(table, edgeID, sessionGeneration)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf(
			"%w: validate last-known-good route table: %w",
			ErrInvalidPersistedTable,
			err,
		)
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("inspect last-known-good route table: %w", err)
	}
	return snapshot, info.ModTime(), nil
}

func (store *Store) discardPersistedTable(loadErr error) {
	if !errors.Is(loadErr, ErrInvalidPersistedTable) {
		store.logger.Warn(
			"could not load last-known-good route table",
			"path",
			store.path,
			"error",
			loadErr,
		)
		return
	}
	removeErr := os.Remove(store.path)
	if removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
		store.logger.Warn(
			"could not discard last-known-good route table",
			"path",
			store.path,
			"load_error",
			loadErr,
			"remove_error",
			removeErr,
		)
		return
	}
	if errors.Is(loadErr, ErrPreviousSession) {
		store.logger.Debug("discarded previous-session route table", "path", store.path)
		return
	}
	store.logger.Info(
		"discarded invalid last-known-good route table",
		"path",
		store.path,
		"error",
		loadErr,
	)
}
