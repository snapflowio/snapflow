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
	"testing"

	"github.com/google/uuid"
	"github.com/snapflowio/tunnel-go/protocol"
)

const (
	firstPort  uint16 = 10_001
	secondPort uint16 = 10_002
)

type testRoute struct {
	port    uint16
	backend uuid.UUID
	limit   int
}

type testHandle struct {
	route  testRoute
	failed string
	closed bool
}

func (handle *testHandle) Matches(route testRoute) bool {
	return handle.failed == "" && handle.route == route
}

func (handle *testHandle) Failure() (string, bool) {
	return handle.failed, handle.failed != ""
}

func (handle *testHandle) Close() { handle.closed = true }

type testOpener struct {
	opened  []*testHandle
	refused map[uint16]error
}

func (opener *testOpener) open(ctx context.Context, route testRoute) (*testHandle, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := opener.refused[route.port]; err != nil {
		return nil, err
	}
	handle := &testHandle{route: route}
	opener.opened = append(opener.opened, handle)
	return handle, nil
}

func newTestTable(t *testing.T, opener *testOpener) *Table[testRoute, *testHandle] {
	t.Helper()
	table, err := NewTable(TableSpec[testRoute, *testHandle]{
		Protocol: protocol.ProtocolTCP,
		Port:     func(route testRoute) uint16 { return route.port },
		Backend:  func(route testRoute) uuid.UUID { return route.backend },
		Open:     opener.open,
	})
	if err != nil {
		t.Fatalf("create table: %v", err)
	}
	return table
}

func TestTableKeepsMatchingListenersAndReplacesChangedOnes(t *testing.T) {
	t.Parallel()
	opener := &testOpener{}
	table := newTestTable(t, opener)
	route := testRoute{port: firstPort, backend: uuid.New(), limit: 1}
	if err := table.Reconcile(context.Background(), []testRoute{route}); err != nil {
		t.Fatalf("first reconcile: %v", err)
	}
	if err := table.Reconcile(context.Background(), []testRoute{route}); err != nil {
		t.Fatalf("unchanged reconcile: %v", err)
	}
	if len(opener.opened) != 1 {
		t.Fatalf("listeners opened = %d, want the unchanged listener kept", len(opener.opened))
	}
	changed := route
	changed.limit = 2
	if err := table.Reconcile(context.Background(), []testRoute{changed}); err != nil {
		t.Fatalf("changed reconcile: %v", err)
	}
	if len(opener.opened) != 2 || !opener.opened[0].closed {
		t.Fatal("a listener with changed settings was not replaced")
	}
}

func TestTableReportsFailuresAndForgetsRemovedRoutes(t *testing.T) {
	t.Parallel()
	refusal := errors.New("address already in use")
	opener := &testOpener{refused: map[uint16]error{secondPort: refusal}}
	table := newTestTable(t, opener)
	serving := testRoute{port: firstPort, backend: uuid.New()}
	refused := testRoute{port: secondPort, backend: uuid.New()}
	if err := table.Reconcile(context.Background(), []testRoute{serving, refused}); err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	statuses := map[uuid.UUID]Status{}
	for _, status := range table.Statuses() {
		statuses[status.BackendID] = status
	}
	if !statuses[serving.backend].Listening ||
		statuses[refused.backend].Listening ||
		statuses[refused.backend].FailureReason != refusal.Error() {
		t.Fatalf("statuses = %+v, want one listening and one refused route", statuses)
	}
	if err := table.Reconcile(context.Background(), nil); err != nil {
		t.Fatalf("empty reconcile: %v", err)
	}
	if len(table.Statuses()) != 0 || !opener.opened[0].closed {
		t.Fatal("removed routes kept their listener or status")
	}
}

func TestTableReopensFailedListeners(t *testing.T) {
	t.Parallel()
	opener := &testOpener{}
	table := newTestTable(t, opener)
	route := testRoute{port: firstPort, backend: uuid.New()}
	if err := table.Reconcile(context.Background(), []testRoute{route}); err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	opener.opened[0].failed = "accept failed"
	if err := table.Reconcile(context.Background(), []testRoute{route}); err != nil {
		t.Fatalf("reconcile after failure: %v", err)
	}
	if len(opener.opened) != 2 || !opener.opened[0].closed {
		t.Fatal("a failed listener was not replaced")
	}
}

func TestClosedTableRefusesReconciliation(t *testing.T) {
	t.Parallel()
	table := newTestTable(t, &testOpener{})
	table.Close()
	if err := table.Reconcile(context.Background(), nil); !errors.Is(err, errTableClosed) {
		t.Fatalf("reconcile after close = %v, want closed", err)
	}
}
