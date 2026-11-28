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
	"sync"
	"sync/atomic"
	"time"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

type SessionGeneration func() int32

type Store struct {
	logger            *slog.Logger
	current           atomic.Pointer[Snapshot]
	mu                sync.Mutex
	ready             atomic.Bool
	lastAppliedAt     atomic.Int64
	refreshFailures   atomic.Uint64
	updates           chan struct{}
	edgeID            string
	sessionGeneration SessionGeneration
}

func NewStore(
	edgeID string,
	sessionGeneration SessionGeneration,
	opts ...Option,
) (*Store, error) {
	if edgeID == "" || sessionGeneration == nil {
		return nil, errors.New("edge route store requires Edge identity and session generation")
	}
	store := &Store{
		logger:            newOptions(opts).logger,
		updates:           make(chan struct{}, 1),
		edgeID:            edgeID,
		sessionGeneration: sessionGeneration,
	}
	store.current.Store(emptySnapshot())
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
	store.logRejectedRoutes(current, snapshot)
	store.current.Store(snapshot)
	store.lastAppliedAt.Store(time.Now().UnixNano())
	store.ready.Store(true)
	select {
	case store.updates <- struct{}{}:
	default:
	}
	return nil
}

func (store *Store) logRejectedRoutes(previous, snapshot *Snapshot) {
	logged := make(map[rejectionKey]struct{}, len(previous.RejectedRoutes()))
	for _, rejection := range previous.RejectedRoutes() {
		logged[rejection.key()] = struct{}{}
	}
	for _, rejection := range snapshot.RejectedRoutes() {
		if _, seen := logged[rejection.key()]; seen {
			continue
		}
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
