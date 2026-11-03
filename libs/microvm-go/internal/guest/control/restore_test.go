// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package control

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func restoreTestRequest() RestoreRequest {
	return RestoreRequest{
		Identity: RestoredIdentity{
			InstanceID:         "00000000-0000-4000-8000-000000000003",
			GenerationID:       "generation-2",
			GuestServiceTokens: map[string]string{"test-service": strings.Repeat("c", 64)},
			ControlAuthToken:   strings.Repeat("d", 64),
			Hostname:           "restored",
			MachineID:          strings.Repeat("a", 32),
			HostUnixNano:       1,
			RandomSeed:         make([]byte, RandomSeedBytes),
		},
		Session: SessionRequest{
			MinimumProtocolVersion: ProtocolVersion,
			MaximumProtocolVersion: ProtocolVersion,
			Features:               ProtocolFeatures(),
			HostSessionID:          "00000000-0000-4000-8000-000000000020",
		},
	}
}

func postRestore(t *testing.T, server *Server, token string, request RestoreRequest) (*httptest.ResponseRecorder, Problem) {
	t.Helper()
	body, err := json.Marshal(request)
	if err != nil {
		t.Fatal(err)
	}
	httpRequest := httptest.NewRequestWithContext(t.Context(), http.MethodPost, RestorePath, strings.NewReader(string(body)))
	httpRequest.Header.Set("Content-Type", "application/json")
	if token != "" {
		httpRequest.Header.Set(ControlTokenHeader, token)
	}
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httpRequest)
	var problem Problem
	if response.Code != http.StatusOK {
		if err := json.Unmarshal(response.Body.Bytes(), &problem); err != nil {
			t.Fatalf("restore problem is not JSON: %s", response.Body.String())
		}
	}
	return response, problem
}

func TestRestoreRequiresTheSnapshotControlCredentialButNoSession(t *testing.T) {
	store := controlTestStore(t)
	server, err := NewServer(testSessionResetter{}, store)
	if err != nil {
		t.Fatal(err)
	}

	response, problem := postRestore(t, server, "", restoreTestRequest())
	if response.Code != http.StatusUnauthorized || problem.Code != "CONTROL_CREDENTIAL_INVALID" {
		t.Fatalf("restore without credential = %d %s, want 401", response.Code, problem.Code)
	}
	invalid := restoreTestRequest()
	invalid.Session.HostSessionID = "not-a-uuid"
	response, problem = postRestore(t, server, store.Snapshot().ControlAuthToken, invalid)
	if response.Code != http.StatusBadRequest || problem.Details == nil || problem.Details.Step != RestoreStepRequest {
		t.Fatalf("restore with an invalid session request = %d %+v, want 400 at the request step", response.Code, problem)
	}
}

func TestRestoreRequiresAFreshRandomSeed(t *testing.T) {
	store := controlTestStore(t)
	server, err := NewServer(testSessionResetter{}, store)
	if err != nil {
		t.Fatal(err)
	}
	request := restoreTestRequest()
	request.Identity.RandomSeed = nil

	response, problem := postRestore(t, server, store.Snapshot().ControlAuthToken, request)
	if response.Code != http.StatusBadRequest || problem.Details == nil || problem.Details.Step != RestoreStepRequest {
		t.Fatalf("restore without a random seed = %d %+v, want 400 at the request step", response.Code, problem)
	}
	if store.Snapshot().GenerationID != "generation-1" {
		t.Fatal("a restore without a random seed changed the guest identity")
	}
}

func TestRestoreRejectsWorkloadForAnotherIdentity(t *testing.T) {
	store := controlTestStore(t)
	server, err := NewServer(testSessionResetter{}, store)
	if err != nil {
		t.Fatal(err)
	}
	request := restoreTestRequest()
	request.Workload = &InitializeWorkloadRequest{
		InstanceID:   request.Identity.InstanceID,
		GenerationID: "generation-other",
		OSUser:       "snapflow",
	}

	response, problem := postRestore(t, server, store.Snapshot().ControlAuthToken, request)
	if response.Code != http.StatusBadRequest || problem.Details == nil || problem.Details.Step != RestoreStepRequest {
		t.Fatalf("restore with a mismatched workload = %d %+v, want 400 at the request step", response.Code, problem)
	}
	if store.Snapshot().GenerationID != "generation-1" {
		t.Fatal("a rejected restore changed the guest identity")
	}
}

func TestRestoreReportsTheFailedStepWithoutRotatingTheGuest(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("the identity step would change the real hostname as root")
	}
	store := controlTestStore(t)
	server, err := NewServer(testSessionResetter{}, store)
	if err != nil {
		t.Fatal(err)
	}
	previousKey := server.guestKeyIDForTest()

	response, problem := postRestore(t, server, store.Snapshot().ControlAuthToken, restoreTestRequest())
	if response.Code != http.StatusInternalServerError || problem.Details == nil || problem.Details.Step != RestoreStepIdentity {
		t.Fatalf("restore without permission to set the hostname = %d %+v, want a failure at the identity step", response.Code, problem)
	}
	current := store.Snapshot()
	if current.GenerationID != "generation-1" || current.ControlAuthToken != strings.Repeat("b", 64) {
		t.Fatal("a failed identity step rotated the guest credentials")
	}
	if server.guestKeyIDForTest() != previousKey || len(server.guestSessions) != 0 {
		t.Fatal("a failed restore installed a new guest key or session")
	}
}

func (s *Server) guestKeyIDForTest() string {
	s.sessionMu.Lock()
	defer s.sessionMu.Unlock()
	return guestKeyID(s.guestPublicKey)
}
