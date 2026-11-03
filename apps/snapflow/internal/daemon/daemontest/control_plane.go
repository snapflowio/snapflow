// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemontest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/tunnel/plan"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	apiPrefix              = "/api"
	connectionToken        = "daemontest-connection-token"
	sessionToken           = "daemontest-session-token"
	planVersion            = "1"
	policySchemaVersion    = 1
	policyRevision         = 1
	sessionGeneration      = 1
	validity               = time.Hour
	planLifetime           = 50 * time.Second
	entityTagHeader        = "ETag"
	contentTypeHeader      = "Content-Type"
	jsonContentType        = "application/json"
	ifNoneMatchHeader      = "If-None-Match"
	entityTagQuote         = `"`
	sessionRoute           = "/api/machines/session"
	sessionRenewRoute      = "/api/machines/session/renew"
	policyRoute            = "/api/machines/control-policy"
	tunnelPlanRoute        = "/api/machines/tunnels/plan"
	healthcheckRoute       = "/api/machines/healthcheck"
	placementsRoute        = "/api/machines/usage/placements"
	desiredStateRoute      = "/api/machines/sandboxes/desired-state"
	observedStatusRoute    = "/api/machines/sandboxes/observed-status"
	snapshotInventoryRoute = "/api/machines/snapshots/observed-inventory"
	jobsPollRoute          = "/api/jobs/poll"
)

type ControlPlane struct {
	t           testing.TB
	server      *httptest.Server
	machineID   uuid.UUID
	mu          sync.Mutex
	readiness   []apiclient.MachineReadinessState
	reasons     []string
	unhandled   []string
	sessionOpen bool
	ready       chan struct{}
	readyOnce   sync.Once
}

func newControlPlane(t testing.TB, machineID uuid.UUID) *ControlPlane {
	controlPlane := &ControlPlane{t: t, machineID: machineID, ready: make(chan struct{})}
	mux := http.NewServeMux()
	mux.HandleFunc(http.MethodPost+" "+sessionRoute, controlPlane.createSession)
	mux.HandleFunc(http.MethodDelete+" "+sessionRoute, controlPlane.closeSession)
	mux.HandleFunc(http.MethodPost+" "+sessionRenewRoute, controlPlane.renewSession)
	mux.HandleFunc(http.MethodGet+" "+policyRoute, controlPlane.policy)
	mux.HandleFunc(http.MethodGet+" "+tunnelPlanRoute, controlPlane.tunnelPlan)
	mux.HandleFunc(http.MethodPost+" "+healthcheckRoute, controlPlane.healthcheck)
	mux.HandleFunc(http.MethodGet+" "+placementsRoute, controlPlane.placements)
	mux.HandleFunc(http.MethodGet+" "+desiredStateRoute, controlPlane.notModifiedAfterWait)
	mux.HandleFunc(http.MethodPost+" "+observedStatusRoute, controlPlane.acknowledge)
	mux.HandleFunc(http.MethodPost+" "+snapshotInventoryRoute, controlPlane.acknowledge)
	mux.HandleFunc(http.MethodGet+" "+jobsPollRoute, controlPlane.pollJobs)
	mux.HandleFunc("/", controlPlane.unhandledRequest)
	controlPlane.server = httptest.NewServer(mux)
	return controlPlane
}

func (controlPlane *ControlPlane) APIURL() string {
	return controlPlane.server.URL + apiPrefix
}

func (controlPlane *ControlPlane) Readiness() []apiclient.MachineReadinessState {
	controlPlane.mu.Lock()
	defer controlPlane.mu.Unlock()
	return slices.Clone(controlPlane.readiness)
}

// ReadinessReasons holds the reason published with each readiness state, in
// order; an empty string means none was given.
func (controlPlane *ControlPlane) ReadinessReasons() []string {
	controlPlane.mu.Lock()
	defer controlPlane.mu.Unlock()
	return slices.Clone(controlPlane.reasons)
}

func (controlPlane *ControlPlane) Unhandled() []string {
	controlPlane.mu.Lock()
	defer controlPlane.mu.Unlock()
	return slices.Clone(controlPlane.unhandled)
}

func (controlPlane *ControlPlane) SessionOpen() bool {
	controlPlane.mu.Lock()
	defer controlPlane.mu.Unlock()
	return controlPlane.sessionOpen
}

func (controlPlane *ControlPlane) close() {
	controlPlane.server.CloseClientConnections()
	controlPlane.server.Close()
}

func (controlPlane *ControlPlane) createSession(writer http.ResponseWriter, request *http.Request) {
	controlPlane.mu.Lock()
	controlPlane.sessionOpen = true
	controlPlane.mu.Unlock()
	controlPlane.writeJSON(writer, http.StatusCreated, controlPlane.session())
}

func (controlPlane *ControlPlane) renewSession(writer http.ResponseWriter, request *http.Request) {
	controlPlane.writeJSON(writer, http.StatusOK, controlPlane.session())
}

func (controlPlane *ControlPlane) closeSession(writer http.ResponseWriter, request *http.Request) {
	controlPlane.mu.Lock()
	controlPlane.sessionOpen = false
	controlPlane.mu.Unlock()
	writer.WriteHeader(http.StatusNoContent)
}

func (controlPlane *ControlPlane) session() apiclient.MachineSessionDto {
	return apiclient.MachineSessionDto{
		ExpiresAt: time.Now().Add(validity), Generation: sessionGeneration, SessionId: uuid.New(),
		Token: sessionToken, TokenType: apiclient.MachineSessionDtoTokenTypeDPoP,
	}
}

func (controlPlane *ControlPlane) policy(writer http.ResponseWriter, request *http.Request) {
	issuedAt := time.Now()
	controlPlane.writeJSON(writer, http.StatusOK, apiclient.MachineControlPolicyDto{
		ConnectionToken: connectionToken, ExpiresAt: issuedAt.Add(validity), GuestRegistryUrl: guestRegistryURL,
		IssuedAt: issuedAt, Revision: policyRevision, SchemaVersion: policySchemaVersion,
	})
}

func (controlPlane *ControlPlane) tunnelPlan(writer http.ResponseWriter, request *http.Request) {
	if request.Header.Get(ifNoneMatchHeader) != "" {
		controlPlane.waitForRequest(request)
		if request.Context().Err() != nil {
			return
		}
	}
	generatedAt := time.Now()
	document := apiclient.MachineTunnelPlanDto{
		Bindings: []apiclient.MachineTunnelBindingDto{}, ExpiresAt: generatedAt.Add(planLifetime), GeneratedAt: generatedAt,
		MachineId: controlPlane.machineID, MachineSessionGeneration: sessionGeneration, Version: planVersion,
	}
	digest, err := plan.DocumentDigest(&document)
	if err != nil {
		controlPlane.t.Errorf("digest the fake tunnel plan: %v", err)
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}
	document.Digest = digest
	writer.Header().Set(entityTagHeader, entityTagQuote+digest+entityTagQuote)
	controlPlane.writeJSON(writer, http.StatusOK, document)
}

func (controlPlane *ControlPlane) healthcheck(writer http.ResponseWriter, request *http.Request) {
	var healthcheck apiclient.MachineHealthcheck
	if err := json.NewDecoder(request.Body).Decode(&healthcheck); err != nil {
		controlPlane.t.Errorf("decode healthcheck: %v", err)
		writer.WriteHeader(http.StatusBadRequest)
		return
	}
	if healthcheck.Readiness.State != "" {
		controlPlane.mu.Lock()
		controlPlane.readiness = append(controlPlane.readiness, healthcheck.Readiness.State)
		controlPlane.reasons = append(controlPlane.reasons, valueOrEmpty(healthcheck.Readiness.Reason))
		controlPlane.mu.Unlock()
		if healthcheck.Readiness.State == apiclient.MachineReadinessStateReady {
			controlPlane.readyOnce.Do(func() { close(controlPlane.ready) })
		}
	}
	writer.WriteHeader(http.StatusOK)
}

func (controlPlane *ControlPlane) placements(writer http.ResponseWriter, request *http.Request) {
	controlPlane.writeJSON(writer, http.StatusOK, apiclient.MachineReportablePlacementPageDto{
		Items: []apiclient.MachineReportablePlacementDto{},
	})
}

func (controlPlane *ControlPlane) acknowledge(writer http.ResponseWriter, request *http.Request) {
	writer.WriteHeader(http.StatusNoContent)
}

func (controlPlane *ControlPlane) pollJobs(writer http.ResponseWriter, request *http.Request) {
	controlPlane.waitForRequest(request)
	writer.WriteHeader(http.StatusRequestTimeout)
}

func (controlPlane *ControlPlane) notModifiedAfterWait(writer http.ResponseWriter, request *http.Request) {
	controlPlane.waitForRequest(request)
	writer.WriteHeader(http.StatusNotModified)
}

func (controlPlane *ControlPlane) waitForRequest(request *http.Request) {
	timer := time.NewTimer(control.LongPollWait)
	defer timer.Stop()
	select {
	case <-request.Context().Done():
	case <-timer.C:
	}
}

func (controlPlane *ControlPlane) unhandledRequest(writer http.ResponseWriter, request *http.Request) {
	controlPlane.mu.Lock()
	controlPlane.unhandled = append(controlPlane.unhandled, request.Method+" "+request.URL.Path)
	controlPlane.mu.Unlock()
	writer.WriteHeader(http.StatusNotFound)
}

func (controlPlane *ControlPlane) writeJSON(writer http.ResponseWriter, statusCode int, value any) {
	writer.Header().Set(contentTypeHeader, jsonContentType)
	writer.WriteHeader(statusCode)
	if err := json.NewEncoder(writer).Encode(value); err != nil {
		controlPlane.t.Errorf("encode fake control-plane response: %v", err)
	}
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
