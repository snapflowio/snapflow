// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestParseBindsSnapshotAndRoutesToEdgeSession(t *testing.T) {
	t.Parallel()
	fixture := newRouteFixture()
	snapshot, err := Parse(fixture.snapshot("1"), fixture.edgeID, testEdgeSessionGeneration)
	if err != nil {
		t.Fatalf("parse route snapshot: %v", err)
	}
	routes := snapshot.HTTPRoutes("APP.EXAMPLE.TEST.", "/path", fixture.now)
	if len(routes) != 1 || routes[0].ExposureGeneration != 2 {
		t.Fatalf("HTTP routes = %+v, want one generation-2 route", routes)
	}
	binding := snapshot.machineBindings[fixture.machineID]
	if !snapshot.HasBinding(
		fixture.machineID,
		uint32(testMachineSessionGeneration),
		binding.Binding,
		fixture.now,
	) {
		t.Fatal("valid session-fenced Machine binding was rejected")
	}
	if _, err := Parse(fixture.snapshot("1"), uuid.NewString(), testEdgeSessionGeneration); err == nil {
		t.Fatal("snapshot for another Edge was accepted")
	} else if !errors.Is(err, ErrEdgeRecipientMismatch) {
		t.Fatalf("snapshot for another Edge error = %v", err)
	}
	if _, err := Parse(
		fixture.snapshot("1"),
		fixture.edgeID,
		testEdgeSessionGeneration+1,
	); !errors.Is(err, ErrPreviousSession) {
		t.Fatalf("snapshot from a previous session error = %v", err)
	}
	if _, err := Parse(
		fixture.snapshot("1"),
		fixture.edgeID,
		testEdgeSessionGeneration-1,
	); !errors.Is(err, ErrSessionRecipientMismatch) {
		t.Fatalf("snapshot for a future session error = %v", err)
	}
}

func TestParseRejectsExpiredOrUnboundRoute(t *testing.T) {
	t.Parallel()
	fixture := newRouteFixture()
	expired := fixture.snapshot("1")
	expired.GeneratedAt = fixture.now.Add(-2 * time.Minute)
	expired.ExpiresAt = fixture.now.Add(-time.Minute)
	recalculateSnapshotDigest(t, expired)
	if _, err := Parse(expired, fixture.edgeID, testEdgeSessionGeneration); err == nil {
		t.Fatal("expired route snapshot was accepted")
	}
	unbound := fixture.snapshot("2")
	unbound.HttpRoutes[0].BindingId = uuid.New()
	recalculateSnapshotDigest(t, unbound)
	assertOnlyRouteRejected(t, fixture, unbound)
}

func TestExpiredSnapshotStopsAllTraffic(t *testing.T) {
	t.Parallel()
	fixture := newRouteFixture()
	snapshot, err := Parse(fixture.snapshot("1"), fixture.edgeID, testEdgeSessionGeneration)
	if err != nil {
		t.Fatalf("parse route snapshot: %v", err)
	}
	afterExpiry := fixture.now.Add(time.Minute)
	if len(snapshot.HTTPRoutes("app.example.test", "/", afterExpiry)) != 0 ||
		len(snapshot.TCPRoutes(afterExpiry)) != 0 ||
		len(snapshot.UDPListenerRoutes(afterExpiry)) != 0 {
		t.Fatal("expired snapshot continued serving traffic")
	}
}

func TestParseRejectsContentChangedUnderDigest(t *testing.T) {
	t.Parallel()
	fixture := newRouteFixture()
	table := fixture.snapshot("1")
	table.HttpRoutes[0].TargetPort++
	if _, err := Parse(table, fixture.edgeID, testEdgeSessionGeneration); err == nil {
		t.Fatal("route snapshot with changed content was accepted")
	}
}

func TestParseRejectsUnknownSnapshotFields(t *testing.T) {
	t.Parallel()
	fixture := newRouteFixture()
	payload, err := json.Marshal(fixture.snapshot("1"))
	if err != nil {
		t.Fatalf("encode route snapshot: %v", err)
	}
	var document map[string]any
	if err := json.Unmarshal(payload, &document); err != nil {
		t.Fatalf("decode route snapshot document: %v", err)
	}
	document["unexpected"] = true
	payload, err = json.Marshal(document)
	if err != nil {
		t.Fatalf("encode route snapshot document: %v", err)
	}
	if _, err := DecodeSnapshot(payload); err == nil {
		t.Fatal("route snapshot with unknown fields was accepted")
	}
}

func TestParseRejectsHostileHTTPHostsAndPaths(t *testing.T) {
	t.Parallel()
	for _, hostname := range []string{
		"attacker.example/path",
		"user@attacker.example",
		"-invalid.example",
		"invalid_.example",
		"attacker.example:invalid",
	} {
		fixture := newRouteFixture()
		table := fixture.snapshot("1")
		table.HttpRoutes[0].PublicHost = hostname
		table.HttpRoutes[0].Hostnames = []string{hostname}
		recalculateSnapshotDigest(t, table)
		assertOnlyRouteRejected(t, fixture, table)
	}
	for _, routePath := range []string{
		"//attacker.example",
		`/safe\..\admin`,
		"/path?query",
		"/path#fragment",
		"/%2e%2e/admin",
		"/path\r\ninjected",
		" /untrimmed",
	} {
		fixture := newRouteFixture()
		table := fixture.snapshot("1")
		table.HttpRoutes[0].Policy.Path = routePath
		recalculateSnapshotDigest(t, table)
		assertOnlyRouteRejected(t, fixture, table)
	}
}

func TestParseKeepsServableRoutesBesideAnUnservableOne(t *testing.T) {
	t.Parallel()
	fixture := newRouteFixture()
	table := fixture.snapshot("1")
	broken := table.HttpRoutes[0]
	broken.BackendId = uuid.New()
	broken.Policy.Path = "/broken?query"
	table.HttpRoutes = append(table.HttpRoutes, broken)
	recalculateSnapshotDigest(t, table)
	snapshot, err := Parse(table, fixture.edgeID, testEdgeSessionGeneration)
	if err != nil {
		t.Fatalf("parse snapshot: %v", err)
	}
	if routes := snapshot.HTTPRoutes("app.example.test", "/", fixture.now); len(routes) != 1 {
		t.Fatalf("servable routes = %d, want 1", len(routes))
	}
	if rejected := snapshot.RejectedRoutes(); len(rejected) != 1 || rejected[0].BackendID != broken.BackendId.String() {
		t.Fatalf("rejected routes = %+v, want only the broken route", rejected)
	}
}
