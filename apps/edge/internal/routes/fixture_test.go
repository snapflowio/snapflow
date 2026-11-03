// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package routes

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	testEdgeSessionGeneration    = int32(7)
	testMachineSessionGeneration = 4
	expectedEmptySnapshotDigest  = "2e2d993eee2c66dcc786c3339214011c3831e0d93b6bd796578d67e8fff302a5"
)

type routeFixture struct {
	edgeID     string
	machineID  uuid.UUID
	bindingID  uuid.UUID
	owner      uuid.UUID
	sandboxID  string
	exposureID uuid.UUID
	now        time.Time
}

func newRouteFixture() routeFixture {
	return routeFixture{
		edgeID:     uuid.NewString(),
		machineID:  uuid.New(),
		bindingID:  uuid.New(),
		owner:      uuid.New(),
		sandboxID:  "sandbox-test",
		exposureID: uuid.New(),
		now:        time.Now().UTC().Truncate(time.Millisecond),
	}
}

func (fixture routeFixture) snapshot(version string) *apiclient.EdgeRouteSnapshotDto {
	leaseExpiry := fixture.now.Add(45 * time.Second)
	base := apiclient.EdgeHttpRouteDto{
		BackendId:            uuid.New(),
		State:                apiclient.ExposureBackendStateActive,
		MachineId:            fixture.machineID,
		OwnerId:              fixture.owner,
		BindingId:            fixture.bindingID,
		AssignmentGeneration: 3,
		ExposureGeneration:   2,
		SandboxId:            fixture.sandboxID,
		ExposureId:           fixture.exposureID,
		ExposureName:         "web",
		PublicHost:           "app.example.test",
		TargetHost:           "runtime",
		TargetPort:           8080,
		LeaseExpiresAt:       leaseExpiry,
		Protocol:             "http",
		TrafficWeight:        100,
		Hostnames:            []string{"app.example.test"},
		Policy: apiclient.EdgeHttpRoutePolicyDto{
			Visibility:         apiclient.ExposureVisibilityProtected,
			Path:               "/",
			MaxBodyBytes:       1 << 20,
			ReadTimeoutSeconds: 30,
			SendTimeoutSeconds: 30,
			UpstreamProtocol:   apiclient.HttpUpstreamProtocolHttp,
			AllowedOrigins:     []string{},
		},
	}
	snapshot := &apiclient.EdgeRouteSnapshotDto{
		EdgeId:                uuid.MustParse(fixture.edgeID),
		EdgeSessionGeneration: int(testEdgeSessionGeneration),
		Version:               version,
		Digest:                strings.Repeat("a", 64),
		GeneratedAt:           fixture.now,
		ExpiresAt:             fixture.now.Add(50 * time.Second),
		TrustedHttpProxyCidrs: []string{"192.0.2.0/24"},
		MachineBindings: []apiclient.EdgeMachineBindingDto{{
			MachineId:                fixture.machineID,
			MachineSessionGeneration: testMachineSessionGeneration,
			BindingId:                fixture.bindingID,
			BindingRevision:          1,
			BindingDigest:            strings.Repeat("b", 64),
			LeaseExpiresAt:           leaseExpiry,
		}},
		HttpRoutes: []apiclient.EdgeHttpRouteDto{base},
		TcpRoutes:  []apiclient.EdgeTcpRouteDto{},
		UdpRoutes:  []apiclient.EdgeUdpRouteDto{},
	}
	digest, err := SnapshotDigest(snapshot)
	if err != nil {
		panic(err)
	}
	snapshot.Digest = digest
	return snapshot
}

func recalculateSnapshotDigest(
	t *testing.T,
	table *apiclient.EdgeRouteSnapshotDto,
) {
	t.Helper()
	digest, err := SnapshotDigest(table)
	if err != nil {
		t.Fatalf("calculate route snapshot digest: %v", err)
	}
	table.Digest = digest
}

func assertOnlyRouteRejected(
	t *testing.T,
	fixture routeFixture,
	table *apiclient.EdgeRouteSnapshotDto,
) {
	t.Helper()
	snapshot, err := Parse(table, fixture.edgeID, testEdgeSessionGeneration)
	if err != nil {
		t.Fatalf("snapshot with one unservable route was rejected: %v", err)
	}
	rejected := snapshot.RejectedRoutes()
	if len(rejected) != 1 || rejected[0].BackendID != table.HttpRoutes[0].BackendId.String() {
		t.Fatalf("rejected routes = %+v, want the HTTP route", rejected)
	}
	if snapshot.BackendCount() != 0 {
		t.Fatal("unservable route was installed")
	}
}

func fixedGeneration(generation int32) SessionGeneration {
	return func() int32 { return generation }
}
