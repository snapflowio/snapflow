// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"log/slog"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	"github.com/snapflowio/edge/internal/telemetry"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const testCapacityLimit = 100

func firstSessionGeneration() int32 { return 1 }

func emptyRouteSnapshot(edgeID, version string) *apiclient.EdgeRouteSnapshotDto {
	now := time.Now().UTC().Truncate(time.Millisecond)
	snapshot := &apiclient.EdgeRouteSnapshotDto{
		EdgeId:                uuid.MustParse(edgeID),
		EdgeSessionGeneration: 1,
		Version:               version,
		Digest:                "",
		GeneratedAt:           now,
		ExpiresAt:             now.Add(45 * time.Second),
		TrustedHttpProxyCidrs: []string{},
		MachineBindings:       []apiclient.EdgeMachineBindingDto{},
		HttpRoutes:            []apiclient.EdgeHttpRouteDto{},
		TcpRoutes:             []apiclient.EdgeTcpRouteDto{},
		UdpRoutes:             []apiclient.EdgeUdpRouteDto{},
	}
	digest, err := routes.SnapshotDigest(snapshot)
	if err != nil {
		panic(err)
	}
	snapshot.Digest = digest
	return snapshot
}

type recordingAPI struct {
	knownVersions []string
	heartbeats    []apiclient.EdgeHeartbeatDto
	snapshot      *apiclient.EdgeRouteSnapshotDto
	routeFailures int
	routeError    error
}

func (api *recordingAPI) Routes(
	ctx context.Context,
	knownVersion string,
) (RouteRead, error) {
	if err := ctx.Err(); err != nil {
		return RouteRead{}, err
	}
	if api.routeFailures > 0 {
		api.routeFailures--
		return RouteRead{}, api.routeError
	}
	api.knownVersions = append(api.knownVersions, knownVersion)
	if knownVersion == "" {
		return RouteRead{Snapshot: api.snapshot}, nil
	}
	return RouteRead{NotModified: true}, nil
}

func (control *recordingAPI) Heartbeat(
	ctx context.Context,
	heartbeat apiclient.EdgeHeartbeatDto,
) (*apiclient.EdgeHeartbeatResponseDto, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	control.heartbeats = append(control.heartbeats, heartbeat)
	return &apiclient.EdgeHeartbeatResponseDto{CapacityProfile: apiclient.EdgeCapacityProfileDto{
		Version:           edgeCapacityProfileVersion,
		Tunnels:           testCapacityLimit,
		HttpRequests:      testCapacityLimit,
		HttpConnections:   testCapacityLimit,
		HttpStreams:       testCapacityLimit,
		TcpConnections:    testCapacityLimit,
		UdpFlows:          testCapacityLimit,
		BytesPerSecondIn:  testCapacityLimit,
		BytesPerSecondOut: testCapacityLimit,
		PacketsPerSecond:  testCapacityLimit,
	}}, nil
}

type emptyCapacitySource struct {
	ready                  bool
	revoked                []uuid.UUID
	confirmed              map[uuid.UUID]time.Time
	acknowledgementChanges chan struct{}
}

func (source *emptyCapacitySource) BindingAcknowledgementChanges() <-chan struct{} {
	return source.acknowledgementChanges
}

type staticHostSampler struct{}

func (staticHostSampler) Sample() (telemetry.HostSample, error) {
	return telemetry.HostSample{}, nil
}

func (source *emptyCapacitySource) Ready() bool {
	return source.ready
}

func (emptyCapacitySource) SessionCount() int32 {
	return 0
}

func (emptyCapacitySource) BindingAcknowledgements() []apiclient.EdgeBindingAcknowledgementDto {
	return nil
}

func (emptyCapacitySource) TCPConnectionCount() int32 {
	return 0
}

func (emptyCapacitySource) FlowCount() int32 {
	return 0
}

func (emptyCapacitySource) ReportAccessSessions() []uuid.UUID {
	return nil
}

func (source *emptyCapacitySource) ConfirmAccessSession(sessionID uuid.UUID, expiresAt time.Time) {
	if source.confirmed == nil {
		source.confirmed = make(map[uuid.UUID]time.Time)
	}
	source.confirmed[sessionID] = expiresAt
}

func (source *emptyCapacitySource) RevokeAccessSessions(sessionIDs []uuid.UUID) {
	source.revoked = append(source.revoked, sessionIDs...)
}

func (emptyCapacitySource) ListenerStatuses() []apiclient.EdgeRouteListenerStatusDto {
	return nil
}

func TestCoordinatorAppliesValidAccessSessionDecisions(t *testing.T) {
	t.Parallel()
	capacity := &emptyCapacitySource{}
	instance := &Coordinator{status: capacity, logger: slog.New(slog.DiscardHandler)}
	revoked := uuid.New()
	renewed := uuid.New()
	renewedUntil := time.Now().Add(time.Hour).UTC()
	malformed := "not-a-uuid"
	instance.applyAccessSessionDecisions(&apiclient.EdgeHeartbeatResponseDto{
		AccessSessions: []apiclient.EdgeAccessSessionDto{
			{SessionId: renewed, ExpiresAt: renewedUntil},
		},
		RevokedAccessSessionIds: []string{revoked.String(), malformed},
	})
	if len(capacity.revoked) != 1 || capacity.revoked[0] != revoked {
		t.Fatalf("access session revocations = %v, want %s", capacity.revoked, revoked)
	}
	if len(capacity.confirmed) != 1 || !capacity.confirmed[renewed].Equal(renewedUntil) {
		t.Fatalf("access session renewals = %v, want %s until %s", capacity.confirmed, renewed, renewedUntil)
	}
}

func (emptyCapacitySource) OperationalMetrics() OperationalMetrics {
	return OperationalMetrics{}
}

func TestRouteRefreshAlwaysUsesTheCurrentSnapshotVersion(t *testing.T) {
	t.Parallel()
	edgeID := uuid.NewString()
	store, err := routes.OpenStore(t.TempDir(), edgeID, firstSessionGeneration)
	if err != nil {
		t.Fatalf("open route store: %v", err)
	}
	snapshot := emptyRouteSnapshot(edgeID, "7")
	if err := store.Apply(snapshot); err != nil {
		t.Fatalf("seed route store: %v", err)
	}
	control := &recordingAPI{}
	instance, err := NewCoordinator(
		control,
		store,
		&emptyCapacitySource{},
		&staticHostSampler{},
		"test",
	)
	if err != nil {
		t.Fatalf("create coordinator: %v", err)
	}
	if err := instance.refreshRoutes(context.Background()); err != nil {
		t.Fatalf("initial route refresh: %v", err)
	}
	if err := instance.refreshRoutes(context.Background()); err != nil {
		t.Fatalf("incremental route refresh: %v", err)
	}
	if err := instance.refreshRoutes(context.Background()); err != nil {
		t.Fatalf("second conditional route refresh: %v", err)
	}
	if len(control.knownVersions) != 3 {
		t.Fatalf("route requests = %d, want 3", len(control.knownVersions))
	}
	for _, knownDigest := range control.knownVersions {
		if knownDigest != snapshot.Digest {
			t.Fatalf("known route digest = %q, want snapshot digest", knownDigest)
		}
	}
}

func TestHeartbeatReportsRouteReadiness(t *testing.T) {
	t.Parallel()
	store, err := routes.OpenStore(t.TempDir(), uuid.NewString(), firstSessionGeneration)
	if err != nil {
		t.Fatalf("open route store: %v", err)
	}
	control := &recordingAPI{}
	capacity := &emptyCapacitySource{}
	instance, err := NewCoordinator(
		control,
		store,
		capacity,
		&staticHostSampler{},
		"test",
	)
	if err != nil {
		t.Fatalf("create coordinator: %v", err)
	}
	if err := instance.heartbeat(context.Background()); err != nil {
		t.Fatalf("report unsynchronized heartbeat: %v", err)
	}
	capacity.ready = true
	if err := instance.heartbeat(context.Background()); err != nil {
		t.Fatalf("report ready heartbeat: %v", err)
	}
	if len(control.heartbeats) != 2 {
		t.Fatalf("heartbeat count = %d, want 2", len(control.heartbeats))
	}
	if control.heartbeats[0].Capacity.PlacementEligible {
		t.Fatal("unsynchronized edge accepted new assignments")
	}
	if !control.heartbeats[1].Capacity.PlacementEligible {
		t.Fatal("ready edge did not accept new assignments")
	}
}

func TestRouteReadinessRecoversAfterTransientControlFailure(t *testing.T) {
	t.Parallel()
	edgeID := uuid.NewString()
	store, err := routes.OpenStore(t.TempDir(), edgeID, firstSessionGeneration)
	if err != nil {
		t.Fatalf("open route store: %v", err)
	}
	control := &recordingAPI{
		routeFailures: 1,
		routeError:    apiFailure(http.StatusServiceUnavailable),
		snapshot:      emptyRouteSnapshot(edgeID, "1"),
	}
	instance, err := NewCoordinator(
		control,
		store,
		&emptyCapacitySource{},
		&staticHostSampler{},
		"test",
	)
	if err != nil {
		t.Fatalf("create coordinator: %v", err)
	}
	if err := instance.refreshRoutes(context.Background()); !IsRetryable(err) {
		t.Fatalf("transient route refresh error = %v, want retryable", err)
	}
	if store.Ready() {
		t.Fatal("edge became ready without a route table")
	}
	if err := instance.refreshRoutes(context.Background()); err != nil {
		t.Fatalf("recovered route refresh: %v", err)
	}
	if !store.Ready() {
		t.Fatal("edge did not become ready after route synchronization")
	}
}
