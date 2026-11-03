// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edgetest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/edge/internal/routes"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	apiBasePath           = "/api"
	sessionPath           = apiBasePath + "/edge/session"
	sessionRenewPath      = apiBasePath + "/edge/session/renew"
	enrollmentPath        = apiBasePath + "/edge/enrollment"
	routesPath            = apiBasePath + "/edge/routes"
	heartbeatPath         = apiBasePath + "/edge/heartbeat"
	usagePath             = apiBasePath + "/edge/usage-checkpoints"
	usageEpochPath        = apiBasePath + "/edge/usage-epochs"
	speedtestKeysPath     = apiBasePath + "/edge/speedtest-token-keys"
	redeemPath            = apiBasePath + "/edge/protected-access/redeem"
	contentTypeHeader     = "Content-Type"
	ifNoneMatchHeader     = "If-None-Match"
	jsonContentType       = "application/json"
	sessionGeneration     = 1
	sessionLifetime       = time.Hour
	snapshotLifetime      = 45 * time.Second
	leaseLifetime         = 50 * time.Second
	snapshotRefreshMargin = 20 * time.Second
	capacityLimit         = 1_000_000
	capacityProfileV1     = 1
	machineGeneration     = 1
	bindingRevision       = 1
	bindingDigestFiller   = "b"
	bindingDigestLength   = 64
	versionBase           = 10
	sequenceBits          = 63
)

type ControlPlane struct {
	server      *httptest.Server
	edgeID      uuid.UUID
	machineID   uuid.UUID
	bindingID   uuid.UUID
	ownerID     uuid.UUID
	mu          sync.Mutex
	routes      []Route
	version     int
	snapshot    *apiclient.EdgeRouteSnapshotDto
	heartbeats  int
	usageEpoch  int32
	checkpoints []apiclient.EdgeUsageCheckpointDto
}

func newControlPlane(edgeID uuid.UUID, routeSpecs []Route) *ControlPlane {
	controlPlane := &ControlPlane{
		edgeID:    edgeID,
		machineID: uuid.New(),
		bindingID: uuid.New(),
		ownerID:   uuid.New(),
		routes:    routeSpecs,
	}
	mux := http.NewServeMux()
	mux.HandleFunc(sessionPath, controlPlane.createSession)
	mux.HandleFunc(sessionRenewPath, controlPlane.renewSession)
	mux.HandleFunc(enrollmentPath, controlPlane.completeEnrollment)
	mux.HandleFunc(routesPath, controlPlane.routeSnapshot)
	mux.HandleFunc(heartbeatPath, controlPlane.heartbeat)
	mux.HandleFunc(usagePath, controlPlane.ingestUsage)
	mux.HandleFunc(usageEpochPath, controlPlane.openUsageEpoch)
	mux.HandleFunc(speedtestKeysPath, controlPlane.speedtestKeys)
	mux.HandleFunc(redeemPath, controlPlane.redeemGrant)
	controlPlane.server = httptest.NewServer(mux)
	return controlPlane
}

func (controlPlane *ControlPlane) APIURL() string {
	return controlPlane.server.URL + apiBasePath
}

func (controlPlane *ControlPlane) Heartbeats() int {
	controlPlane.mu.Lock()
	defer controlPlane.mu.Unlock()
	return controlPlane.heartbeats
}

func (controlPlane *ControlPlane) UsageCheckpoints() []apiclient.EdgeUsageCheckpointDto {
	controlPlane.mu.Lock()
	defer controlPlane.mu.Unlock()
	return append([]apiclient.EdgeUsageCheckpointDto(nil), controlPlane.checkpoints...)
}

func (controlPlane *ControlPlane) close() {
	controlPlane.server.Close()
}

func (controlPlane *ControlPlane) createSession(writer http.ResponseWriter, request *http.Request) {
	writeJSON(writer, http.StatusCreated, apiclient.EdgeSessionDto{
		Id:         uuid.New(),
		Token:      uuid.NewString(),
		Generation: sessionGeneration,
		ExpiresAt:  time.Now().Add(sessionLifetime).UTC(),
	})
}

func (controlPlane *ControlPlane) renewSession(writer http.ResponseWriter, request *http.Request) {
	writeJSON(writer, http.StatusOK, apiclient.RenewEdgeSessionDto{
		ExpiresAt: time.Now().Add(sessionLifetime).UTC(),
	})
}

func (controlPlane *ControlPlane) completeEnrollment(writer http.ResponseWriter, request *http.Request) {
	http.Error(writer, "the test control plane accepts sessions without enrollment", http.StatusConflict)
}

func (controlPlane *ControlPlane) redeemGrant(writer http.ResponseWriter, request *http.Request) {
	http.Error(writer, "the test control plane issues no protected access grants", http.StatusNotFound)
}

func (controlPlane *ControlPlane) speedtestKeys(writer http.ResponseWriter, request *http.Request) {
	writeJSON(writer, http.StatusOK, []apiclient.SpeedtestTokenKey{})
}

func (controlPlane *ControlPlane) heartbeat(writer http.ResponseWriter, request *http.Request) {
	controlPlane.mu.Lock()
	controlPlane.heartbeats++
	controlPlane.mu.Unlock()
	writeJSON(writer, http.StatusOK, apiclient.EdgeHeartbeatResponseDto{
		EdgeId:                  controlPlane.edgeID,
		AccessSessions:          []apiclient.EdgeAccessSessionDto{},
		RevokedAccessSessionIds: []string{},
		CapacityProfile: apiclient.EdgeCapacityProfileDto{
			Version:           capacityProfileV1,
			Tunnels:           capacityLimit,
			HttpRequests:      capacityLimit,
			HttpConnections:   capacityLimit,
			HttpStreams:       capacityLimit,
			TcpConnections:    capacityLimit,
			UdpFlows:          capacityLimit,
			BytesPerSecondIn:  capacityLimit,
			BytesPerSecondOut: capacityLimit,
			PacketsPerSecond:  capacityLimit,
		},
	})
}

func (controlPlane *ControlPlane) openUsageEpoch(writer http.ResponseWriter, request *http.Request) {
	controlPlane.mu.Lock()
	controlPlane.usageEpoch++
	opened := apiclient.EdgeUsageEpochDto{UsageEpoch: controlPlane.usageEpoch}
	if latest := controlPlane.latestCheckpoint(); latest != nil {
		anchor := latest.Digest
		opened.PreviousDigest = &anchor
	}
	controlPlane.mu.Unlock()
	writeJSON(writer, http.StatusOK, opened)
}

func (controlPlane *ControlPlane) ingestUsage(writer http.ResponseWriter, request *http.Request) {
	var checkpoint apiclient.EdgeUsageCheckpointDto
	if err := json.NewDecoder(request.Body).Decode(&checkpoint); err != nil {
		http.Error(writer, err.Error(), http.StatusUnprocessableEntity)
		return
	}
	controlPlane.mu.Lock()
	status := controlPlane.acceptCheckpoint(checkpoint)
	controlPlane.mu.Unlock()
	if status != http.StatusOK {
		http.Error(writer, http.StatusText(status), status)
		return
	}
	writeJSON(writer, http.StatusOK, apiclient.EdgeUsageCheckpointAcknowledgementDto{
		UsageEpoch: checkpoint.UsageEpoch,
		Sequence:   checkpoint.Sequence,
		Digest:     checkpoint.Digest,
	})
}

func (controlPlane *ControlPlane) acceptCheckpoint(checkpoint apiclient.EdgeUsageCheckpointDto) int {
	for _, accepted := range controlPlane.checkpoints {
		if accepted.UsageEpoch == checkpoint.UsageEpoch && accepted.Sequence == checkpoint.Sequence {
			if accepted.Digest != checkpoint.Digest {
				return http.StatusConflict
			}
			return http.StatusOK
		}
	}
	if checkpoint.UsageEpoch != controlPlane.usageEpoch {
		return http.StatusGone
	}
	expectedSequence := uint64(1)
	previousDigest := ""
	if latest := controlPlane.latestCheckpoint(); latest != nil {
		previousDigest = latest.Digest
		if latest.UsageEpoch == checkpoint.UsageEpoch {
			sequence, err := strconv.ParseUint(latest.Sequence, versionBase, sequenceBits)
			if err != nil {
				return http.StatusInternalServerError
			}
			expectedSequence = sequence + 1
		}
	}
	chained := ""
	if checkpoint.PreviousDigest != nil {
		chained = *checkpoint.PreviousDigest
	}
	if checkpoint.Sequence != strconv.FormatUint(expectedSequence, versionBase) || chained != previousDigest {
		return http.StatusGone
	}
	controlPlane.checkpoints = append(controlPlane.checkpoints, checkpoint)
	return http.StatusOK
}

func (controlPlane *ControlPlane) latestCheckpoint() *apiclient.EdgeUsageCheckpointDto {
	if len(controlPlane.checkpoints) == 0 {
		return nil
	}
	return &controlPlane.checkpoints[len(controlPlane.checkpoints)-1]
}

func (controlPlane *ControlPlane) routeSnapshot(writer http.ResponseWriter, request *http.Request) {
	snapshot, err := controlPlane.currentSnapshot(time.Now())
	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}
	if strings.Trim(request.Header.Get(ifNoneMatchHeader), `"`) == snapshot.Digest {
		writer.WriteHeader(http.StatusNotModified)
		return
	}
	writeJSON(writer, http.StatusOK, snapshot)
}

func (controlPlane *ControlPlane) currentSnapshot(now time.Time) (*apiclient.EdgeRouteSnapshotDto, error) {
	controlPlane.mu.Lock()
	defer controlPlane.mu.Unlock()
	if controlPlane.snapshot != nil && controlPlane.snapshot.ExpiresAt.Sub(now) > snapshotRefreshMargin {
		return controlPlane.snapshot, nil
	}
	controlPlane.version++
	snapshot := controlPlane.buildSnapshot(now.UTC().Truncate(time.Millisecond))
	digest, err := routes.SnapshotDigest(snapshot)
	if err != nil {
		return nil, err
	}
	snapshot.Digest = digest
	controlPlane.snapshot = snapshot
	return snapshot, nil
}

func (controlPlane *ControlPlane) buildSnapshot(now time.Time) *apiclient.EdgeRouteSnapshotDto {
	leaseExpiresAt := now.Add(leaseLifetime)
	httpRoutes := make([]apiclient.EdgeHttpRouteDto, 0, len(controlPlane.routes))
	for _, route := range controlPlane.routes {
		httpRoutes = append(httpRoutes, controlPlane.httpRoute(route, leaseExpiresAt))
	}
	return &apiclient.EdgeRouteSnapshotDto{
		EdgeId:                controlPlane.edgeID,
		EdgeSessionGeneration: sessionGeneration,
		Version:               strconv.FormatInt(int64(controlPlane.version), versionBase),
		GeneratedAt:           now,
		ExpiresAt:             now.Add(snapshotLifetime),
		TrustedHttpProxyCidrs: []string{},
		MachineBindings: []apiclient.EdgeMachineBindingDto{{
			MachineId:                controlPlane.machineID,
			MachineSessionGeneration: machineGeneration,
			BindingId:                controlPlane.bindingID,
			BindingRevision:          bindingRevision,
			BindingDigest:            strings.Repeat(bindingDigestFiller, bindingDigestLength),
			LeaseExpiresAt:           leaseExpiresAt,
		}},
		HttpRoutes: httpRoutes,
		TcpRoutes:  []apiclient.EdgeTcpRouteDto{},
		UdpRoutes:  []apiclient.EdgeUdpRouteDto{},
	}
}

func (controlPlane *ControlPlane) httpRoute(route Route, leaseExpiresAt time.Time) apiclient.EdgeHttpRouteDto {
	return apiclient.EdgeHttpRouteDto{
		BackendId:            route.BackendID,
		State:                apiclient.ExposureBackendStateActive,
		MachineId:            controlPlane.machineID,
		OwnerId:              controlPlane.ownerID,
		BindingId:            controlPlane.bindingID,
		AssignmentGeneration: defaultAssignmentGeneration,
		ExposureGeneration:   defaultExposureGeneration,
		SandboxId:            defaultSandboxID,
		ExposureId:           route.BackendID,
		ExposureName:         defaultExposureName,
		PublicHost:           route.Host,
		TargetHost:           defaultTargetHost,
		TargetPort:           defaultTargetPort,
		LeaseExpiresAt:       leaseExpiresAt,
		Protocol:             apiclient.EdgeHttpRouteDtoProtocolHttp,
		TrafficWeight:        defaultTrafficWeight,
		Hostnames:            []string{route.Host},
		Policy: apiclient.EdgeHttpRoutePolicyDto{
			Visibility:         apiclient.ExposureVisibilityPublic,
			Path:               defaultPath,
			MaxBodyBytes:       defaultMaxBodyBytes,
			ReadTimeoutSeconds: defaultTimeoutSeconds,
			SendTimeoutSeconds: defaultTimeoutSeconds,
			UpstreamProtocol:   apiclient.HttpUpstreamProtocolHttp,
			AllowedOrigins:     []string{},
		},
	}
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set(contentTypeHeader, jsonContentType)
	writer.WriteHeader(status)
	if err := json.NewEncoder(writer).Encode(value); err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
	}
}
