// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package proxy

import (
	"context"
	"errors"
	"sync"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
)

var errTableClosed = errors.New("public listener table is closed")

type Handle[R any] interface {
	Matches(route R) bool
	Failure() (string, bool)
	Close()
}

type TableSpec[R any, H Handle[R]] struct {
	Protocol protocol.Protocol
	Port     func(R) uint16
	Backend  func(R) uuid.UUID
	Open     func(context.Context, R) (H, error)
}

type Table[R any, H Handle[R]] struct {
	spec     TableSpec[R, H]
	mu       sync.Mutex
	handles  map[uint16]H
	statuses map[uuid.UUID]Status
	closed   bool
}

func NewTable[R any, H Handle[R]](spec TableSpec[R, H]) (*Table[R, H], error) {
	if spec.Protocol == "" || spec.Port == nil || spec.Backend == nil || spec.Open == nil {
		return nil, errors.New("public listener table requires a protocol, route keys, and an opener")
	}
	return &Table[R, H]{
		spec:     spec,
		handles:  make(map[uint16]H),
		statuses: make(map[uuid.UUID]Status),
	}, nil
}

func (table *Table[R, H]) Reconcile(ctx context.Context, routes []R) error {
	desired := make(map[uint16]R, len(routes))
	desiredBackends := make(map[uuid.UUID]struct{}, len(routes))
	for _, route := range routes {
		desired[table.spec.Port(route)] = route
		desiredBackends[table.spec.Backend(route)] = struct{}{}
	}
	removed, err := table.removeStale(desired, desiredBackends)
	for _, handle := range removed {
		handle.Close()
	}
	if err != nil {
		return err
	}
	for port, route := range desired {
		if err := table.ensure(ctx, port, route); err != nil {
			return err
		}
	}
	return nil
}

func (table *Table[R, H]) removeStale(
	desired map[uint16]R,
	desiredBackends map[uuid.UUID]struct{},
) ([]H, error) {
	table.mu.Lock()
	defer table.mu.Unlock()
	if table.closed {
		return nil, errTableClosed
	}
	for backendID := range table.statuses {
		if _, exists := desiredBackends[backendID]; !exists {
			delete(table.statuses, backendID)
		}
	}
	var removed []H
	for port, handle := range table.handles {
		route, exists := desired[port]
		if exists && handle.Matches(route) {
			continue
		}
		if reason, failed := handle.Failure(); failed && exists {
			table.setStatusLocked(route, false, reason)
		}
		delete(table.handles, port)
		removed = append(removed, handle)
	}
	return removed, nil
}

func (table *Table[R, H]) ensure(ctx context.Context, port uint16, route R) error {
	table.mu.Lock()
	_, exists := table.handles[port]
	if exists {
		table.setStatusLocked(route, true, "")
	}
	table.mu.Unlock()
	if exists {
		return nil
	}
	handle, err := table.spec.Open(ctx, route)
	table.mu.Lock()
	if err != nil {
		table.setStatusLocked(route, false, err.Error())
		table.mu.Unlock()
		return nil
	}
	_, raced := table.handles[port]
	closed := table.closed
	if !closed && !raced {
		table.handles[port] = handle
		table.setStatusLocked(route, true, "")
	}
	table.mu.Unlock()
	if closed || raced {
		handle.Close()
	}
	if closed {
		return errTableClosed
	}
	return nil
}

func (table *Table[R, H]) setStatusLocked(route R, listening bool, failureReason string) {
	table.statuses[table.spec.Backend(route)] = Status{
		BackendID:     table.spec.Backend(route),
		Protocol:      table.spec.Protocol,
		PublicPort:    table.spec.Port(route),
		Listening:     listening,
		FailureReason: failureReason,
	}
}

func (table *Table[R, H]) Statuses() []Status {
	table.mu.Lock()
	defer table.mu.Unlock()
	return SortedStatuses(table.statuses)
}

func (table *Table[R, H]) Close() {
	table.mu.Lock()
	table.closed = true
	handles := make([]H, 0, len(table.handles))
	for _, handle := range table.handles {
		handles = append(handles, handle)
	}
	table.handles = make(map[uint16]H)
	table.statuses = make(map[uuid.UUID]Status)
	table.mu.Unlock()
	for _, handle := range handles {
		handle.Close()
	}
}
