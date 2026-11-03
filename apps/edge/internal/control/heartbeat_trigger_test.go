// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const outOfCycleHeartbeatBound = heartbeatInterval / 4

type signalingAPI struct {
	recordingAPI
	mu         sync.Mutex
	heartbeats chan struct{}
}

func (api *signalingAPI) Routes(ctx context.Context, knownDigest string) (RouteRead, error) {
	api.mu.Lock()
	defer api.mu.Unlock()
	return api.recordingAPI.Routes(ctx, knownDigest)
}

func (api *signalingAPI) Heartbeat(
	ctx context.Context,
	heartbeat apiclient.EdgeHeartbeatDto,
) (*apiclient.EdgeHeartbeatResponseDto, error) {
	api.mu.Lock()
	response, err := api.recordingAPI.Heartbeat(ctx, heartbeat)
	api.mu.Unlock()
	select {
	case api.heartbeats <- struct{}{}:
	case <-ctx.Done():
	}
	return response, err
}

func (api *signalingAPI) awaitHeartbeat(t *testing.T, within time.Duration, reason string) {
	t.Helper()
	select {
	case <-api.heartbeats:
	case <-time.After(within):
		t.Fatalf("no heartbeat within %s %s", within, reason)
	}
}

func newTriggerCoordinator(
	t *testing.T,
	api *signalingAPI,
	capacity *emptyCapacitySource,
) (*Coordinator, *routes.Store, string) {
	t.Helper()
	edgeID := uuid.NewString()
	store, err := routes.OpenStore(t.TempDir(), edgeID, firstSessionGeneration)
	if err != nil {
		t.Fatalf("open route store: %v", err)
	}
	instance, err := NewCoordinator(api, store, capacity, &staticHostSampler{}, "test")
	if err != nil {
		t.Fatalf("create coordinator: %v", err)
	}
	return instance, store, edgeID
}

func startHeartbeats(t *testing.T, instance *Coordinator) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		instance.runHeartbeat(ctx)
	}()
	t.Cleanup(func() {
		cancel()
		<-done
	})
}

func TestHeartbeatReportsAsSoonAsAMachineSessionBecomesUsable(t *testing.T) {
	t.Parallel()
	api := &signalingAPI{heartbeats: make(chan struct{}, 1)}
	capacity := &emptyCapacitySource{acknowledgementChanges: make(chan struct{}, 1)}
	instance, _, _ := newTriggerCoordinator(t, api, capacity)
	startHeartbeats(t, instance)
	api.awaitHeartbeat(t, outOfCycleHeartbeatBound, "at startup")

	capacity.acknowledgementChanges <- struct{}{}
	api.awaitHeartbeat(t, outOfCycleHeartbeatBound, "after a Machine session became usable")
}

func TestHeartbeatReportsAsSoonAsANewRouteSnapshotIsInstalled(t *testing.T) {
	t.Parallel()
	api := &signalingAPI{heartbeats: make(chan struct{}, 1)}
	instance, _, edgeID := newTriggerCoordinator(t, api, &emptyCapacitySource{})
	api.snapshot = emptyRouteSnapshot(edgeID, "1")
	startHeartbeats(t, instance)
	api.awaitHeartbeat(t, outOfCycleHeartbeatBound, "at startup")

	if err := instance.refreshRoutes(context.Background()); err != nil {
		t.Fatalf("refresh routes: %v", err)
	}
	api.awaitHeartbeat(t, outOfCycleHeartbeatBound, "after a route snapshot was installed")
}

func TestUnchangedRouteSnapshotDoesNotRequestAHeartbeat(t *testing.T) {
	t.Parallel()
	api := &signalingAPI{heartbeats: make(chan struct{}, 1)}
	instance, store, edgeID := newTriggerCoordinator(t, api, &emptyCapacitySource{})
	if err := store.Apply(emptyRouteSnapshot(edgeID, "1")); err != nil {
		t.Fatalf("seed route store: %v", err)
	}
	if err := instance.refreshRoutes(context.Background()); err != nil {
		t.Fatalf("refresh routes: %v", err)
	}
	select {
	case <-instance.heartbeatRequests:
		t.Fatal("an unchanged route snapshot requested a heartbeat")
	default:
	}
}
