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
	"log/slog"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/snapflowio/edge/internal/statefile"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type SessionGeneration func() int32

type Store struct {
	logger            *slog.Logger
	path              string
	current           atomic.Pointer[Snapshot]
	mu                sync.Mutex
	persistedAt       time.Time
	persistedVersion  string
	ready             atomic.Bool
	lastAppliedAt     atomic.Int64
	refreshFailures   atomic.Uint64
	updates           chan struct{}
	edgeID            string
	sessionGeneration SessionGeneration
}

func OpenStore(
	stateDirectory string,
	edgeID string,
	sessionGeneration SessionGeneration,
	opts ...Option,
) (*Store, error) {
	if !filepath.IsAbs(stateDirectory) {
		return nil, errors.New("edge route state directory must be absolute")
	}
	if edgeID == "" || sessionGeneration == nil || sessionGeneration() < 1 {
		return nil, errors.New("edge route store requires Edge identity and session generation")
	}
	if err := statefile.EnsureDirectory(stateDirectory); err != nil {
		return nil, fmt.Errorf("create edge route state directory: %w", err)
	}
	store := &Store{
		logger:            newOptions(opts).logger,
		path:              filepath.Join(stateDirectory, routeTableFilename),
		updates:           make(chan struct{}, 1),
		edgeID:            edgeID,
		sessionGeneration: sessionGeneration,
	}
	snapshot, persistedAt, err := loadSnapshot(store.path, edgeID, sessionGeneration())
	if err != nil {
		store.discardPersistedTable(err)
		snapshot = emptySnapshot()
		persistedAt = time.Time{}
	} else if snapshot.Version() != "" {
		store.ready.Store(true)
	}
	store.persistedAt = persistedAt
	store.persistedVersion = snapshot.Version()
	if !persistedAt.IsZero() {
		store.lastAppliedAt.Store(persistedAt.UnixNano())
	}
	store.current.Store(snapshot)
	return store, nil
}

func (store *Store) Load() *Snapshot {
	return store.current.Load()
}

func (store *Store) Updates() <-chan struct{} {
	return store.updates
}

func (store *Store) Ready() bool {
	return store.ready.Load()
}

func (store *Store) SnapshotAge(now time.Time) time.Duration {
	appliedAt := store.lastAppliedAt.Load()
	if appliedAt == 0 {
		return 0
	}
	return max(now.Sub(time.Unix(0, appliedAt)), 0)
}

func (store *Store) RecordRefreshFailure() {
	store.refreshFailures.Add(1)
}

func (store *Store) RefreshFailures() uint64 {
	return store.refreshFailures.Load()
}

func (store *Store) Apply(table *apiclient.EdgeRouteSnapshotDto) error {
	if table == nil {
		return errors.New("edge route table is required")
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	current := store.current.Load()
	snapshot, err := Parse(table, store.edgeID, store.sessionGeneration())
	if err != nil {
		return err
	}
	if err := rejectAssignmentRegression(current, snapshot); err != nil {
		return err
	}
	if err := rejectSnapshotRegression(current, snapshot); err != nil {
		return err
	}
	now := time.Now()
	store.persist(table, snapshot.Version(), now)
	store.logRejectedRoutes(snapshot)
	store.current.Store(snapshot)
	store.lastAppliedAt.Store(now.UnixNano())
	store.ready.Store(true)
	select {
	case store.updates <- struct{}{}:
	default:
	}
	return nil
}

func (store *Store) logRejectedRoutes(snapshot *Snapshot) {
	for _, rejection := range snapshot.RejectedRoutes() {
		store.logger.Warn(
			"skipped an Edge route the API published but this Edge cannot serve",
			"version", snapshot.Version(),
			"protocol", rejection.Protocol,
			"backend_id", rejection.BackendID,
			"error", rejection.Reason,
		)
	}
}

func rejectSnapshotRegression(current, next *Snapshot) error {
	if current == nil || next == nil || current.Version() == "" {
		return nil
	}
	currentVersion, err := parseSnapshotVersion(current.Version())
	if err != nil {
		return fmt.Errorf("current route snapshot version: %w", err)
	}
	nextVersion, err := parseSnapshotVersion(next.Version())
	if err != nil {
		return err
	}
	if nextVersion < currentVersion || next.generatedAt.Before(current.generatedAt) {
		return fmt.Errorf(
			"route snapshot regressed from version %s to %s",
			current.Version(),
			next.Version(),
		)
	}
	if nextVersion == currentVersion && next.Digest() != current.Digest() {
		return errors.New("route snapshot version was replayed with a different digest")
	}
	return nil
}

func rejectAssignmentRegression(current, next *Snapshot) error {
	if current == nil || next == nil {
		return nil
	}
	for sandboxID, nextGeneration := range next.assignmentGenerations {
		currentGeneration, exists := current.assignmentGenerations[sandboxID]
		if exists && nextGeneration < currentGeneration {
			return fmt.Errorf(
				"runtime %s assignment generation regressed from %d to %d",
				sandboxID,
				currentGeneration,
				nextGeneration,
			)
		}
	}
	return nil
}
