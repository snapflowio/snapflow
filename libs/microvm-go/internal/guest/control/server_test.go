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
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/pelletier/go-toml/v2"
	guestconfig "github.com/snapflowio/microvm-go/guest/config"
)

func TestAdvanceWorkloadGenerationReceipt(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workload-started")
	if err := os.WriteFile(path, []byte("generation-1"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := advanceWorkloadGenerationReceipt(path, false, "generation-1", "generation-2"); err != nil {
		t.Fatal(err)
	}
	receipt, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(receipt) != "generation-2" {
		t.Fatalf("workload receipt = %q, want generation-2", receipt)
	}
	if err := advanceWorkloadGenerationReceipt(path, false, "generation-1", "generation-2"); err != nil {
		t.Fatalf("idempotent receipt advancement failed: %v", err)
	}
	if err := advanceWorkloadGenerationReceipt(path, false, "unrelated", "generation-3"); err == nil {
		t.Fatal("stale workload receipt was accepted")
	}
}

type recordingFilesystemQuiescer struct {
	freezeCalls int
	thawCalls   int
}

func (quiescer *recordingFilesystemQuiescer) Freeze() error {
	quiescer.freezeCalls++
	return nil
}

func (quiescer *recordingFilesystemQuiescer) Thaw() error {
	quiescer.thawCalls++
	return nil
}

func TestSnapshotPreparationFreezesAndThawsFilesystemIdempotently(t *testing.T) {
	filesystem := &recordingFilesystemQuiescer{}
	server, err := NewServer(
		testSessionResetter{},
		controlTestStore(t),
		withFilesystemQuiescer(filesystem),
	)
	if err != nil {
		t.Fatal(err)
	}
	e := echo.New()
	for range 2 {
		request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, ForkPreparePath, nil)
		response := httptest.NewRecorder()
		if err := server.prepareFork(e.NewContext(request, response)); err != nil {
			t.Fatal(err)
		}
	}
	for range 2 {
		request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, ForkResumePath, nil)
		response := httptest.NewRecorder()
		if err := server.resumeFork(e.NewContext(request, response)); err != nil {
			t.Fatal(err)
		}
	}
	if filesystem.freezeCalls != 1 || filesystem.thawCalls != 1 {
		t.Fatalf("filesystem calls = freeze %d, thaw %d", filesystem.freezeCalls, filesystem.thawCalls)
	}
}

func TestRestoredIdentityThawsFilesystemWithoutResumingComponents(t *testing.T) {
	filesystem := &recordingFilesystemQuiescer{}
	server, err := NewServer(
		testSessionResetter{},
		controlTestStore(t),
		withFilesystemQuiescer(filesystem),
	)
	if err != nil {
		t.Fatal(err)
	}
	server.filesystemFrozen = true
	for range 2 {
		if err := server.thawFilesystemForIdentity(); err != nil {
			t.Fatal(err)
		}
	}
	if filesystem.thawCalls != 1 {
		t.Fatalf("filesystem thaw calls = %d, want 1", filesystem.thawCalls)
	}
	if server.filesystemFrozen {
		t.Fatal("filesystem remained frozen before restored identity persistence")
	}
}

func TestPersistIdentityRotatesGuestServiceCredentials(t *testing.T) {
	store := controlTestStore(t)
	credentialRoot := t.TempDir()
	previous := store.Snapshot()
	for name, token := range previous.GuestServiceTokens {
		if err := writeServiceCredential(credentialRoot, name, token); err != nil {
			t.Fatal(err)
		}
	}
	server, err := NewServer(
		testSessionResetter{},
		store,
		withServiceCredentialRoot(credentialRoot),
	)
	if err != nil {
		t.Fatal(err)
	}
	server.secretPaths.started = filepath.Join(t.TempDir(), "workload-started")
	if err := os.WriteFile(server.secretPaths.started, []byte(previous.GenerationID), 0o600); err != nil {
		t.Fatal(err)
	}
	rotatedToken := strings.Repeat("c", 64)
	request := RestoredIdentity{
		InstanceID:         "00000000-0000-4000-8000-000000000003",
		GenerationID:       "generation-2",
		GuestServiceTokens: map[string]string{"test-service": rotatedToken},
		ControlAuthToken:   strings.Repeat("d", 64),
	}
	if err := server.persistIdentity(previous, request); err != nil {
		t.Fatal(err)
	}
	credential, err := os.ReadFile(filepath.Join(credentialRoot, "test-service"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(string(credential)) != rotatedToken {
		t.Fatal("guest service credential was not rotated")
	}
	current := store.Snapshot()
	if current.InstanceID != request.InstanceID ||
		current.GenerationID != request.GenerationID ||
		current.ControlAuthToken != request.ControlAuthToken ||
		current.GuestServiceTokens["test-service"] != rotatedToken {
		t.Fatal("persisted guest identity does not match the rotated identity")
	}
}

func TestDeferredWorkloadGenerationDoesNotPublishEarlyReceipt(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workload-started")
	if err := advanceWorkloadGenerationReceipt(path, true, "generation-1", "generation-2"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("deferred workload receipt exists before initialization: %v", err)
	}
}

func TestDeferredWorkloadGenerationAdvancesAfterInitialization(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workload-started")
	if err := os.WriteFile(path, []byte("generation-1"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := advanceWorkloadGenerationReceipt(path, true, "generation-1", "generation-2"); err != nil {
		t.Fatal(err)
	}
	receipt, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(receipt) != "generation-2" {
		t.Fatalf("workload receipt = %q, want generation-2", receipt)
	}
}

func TestControlServerAuthenticatesEveryRequest(t *testing.T) {
	store := controlTestStore(t)
	server, err := NewServer(testSessionResetter{}, store)
	if err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/v1/fork/prepare", nil)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated response = %d, want %d", response.Code, http.StatusUnauthorized)
	}

	sessionRequestBody, err := json.Marshal(SessionRequest{
		MinimumProtocolVersion: ProtocolVersion,
		MaximumProtocolVersion: ProtocolVersion,
		Features:               ProtocolFeatures(),
		HostSessionID:          "00000000-0000-4000-8000-000000000010",
	})
	if err != nil {
		t.Fatal(err)
	}
	sessionRequest := httptest.NewRequestWithContext(t.Context(), http.MethodPost, SessionPath, strings.NewReader(string(sessionRequestBody)))
	sessionRequest.Header.Set(ControlTokenHeader, store.Snapshot().ControlAuthToken)
	sessionRequest.Header.Set("Content-Type", "application/json")
	sessionResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(sessionResponse, sessionRequest)
	if sessionResponse.Code != http.StatusOK {
		t.Fatalf("session response = %d: %s", sessionResponse.Code, sessionResponse.Body.String())
	}
	var negotiated SessionResponse
	if err := json.Unmarshal(sessionResponse.Body.Bytes(), &negotiated); err != nil {
		t.Fatal(err)
	}

	request = httptest.NewRequestWithContext(t.Context(), http.MethodPost, ForkPreparePath, nil)
	request.Header.Set(ControlTokenHeader, store.Snapshot().ControlAuthToken)
	request.Header.Set(GuestSessionHeader, negotiated.GuestSessionID)
	request.Header.Set(GuestHostSessionHeader, negotiated.HostSessionID)
	response = httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("authenticated response = %d, want %d: %s", response.Code, http.StatusOK, response.Body.String())
	}
}

func TestControlServerReusesHostSession(t *testing.T) {
	store := controlTestStore(t)
	server, err := NewServer(testSessionResetter{}, store)
	if err != nil {
		t.Fatal(err)
	}

	requestBody, err := json.Marshal(SessionRequest{
		MinimumProtocolVersion: ProtocolVersion,
		MaximumProtocolVersion: ProtocolVersion,
		Features:               ProtocolFeatures(),
		HostSessionID:          "00000000-0000-4000-8000-000000000011",
	})
	if err != nil {
		t.Fatal(err)
	}
	var guestSessionID string
	for range maximumGuestSessions + 1 {
		request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, SessionPath, strings.NewReader(string(requestBody)))
		request.Header.Set(ControlTokenHeader, store.Snapshot().ControlAuthToken)
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("session response = %d: %s", response.Code, response.Body.String())
		}
		var negotiated SessionResponse
		if err := json.Unmarshal(response.Body.Bytes(), &negotiated); err != nil {
			t.Fatal(err)
		}
		if guestSessionID == "" {
			guestSessionID = negotiated.GuestSessionID
		} else if negotiated.GuestSessionID != guestSessionID {
			t.Fatalf("guest session changed from %s to %s", guestSessionID, negotiated.GuestSessionID)
		}
	}
	if len(server.guestSessions) != 1 {
		t.Fatalf("stored guest sessions = %d, want 1", len(server.guestSessions))
	}
}

func TestControlServerBindsSessionsToTheBuildDigestComputedAtStartup(t *testing.T) {
	store := controlTestStore(t)
	server, err := NewServer(testSessionResetter{}, store)
	if err != nil {
		t.Fatal(err)
	}
	want, err := executableDigest()
	if err != nil {
		t.Fatal(err)
	}
	if server.buildDigest != want {
		t.Fatalf("startup build digest = %q, want %q", server.buildDigest, want)
	}
	server.buildDigest = "sha256:startup-digest"

	requestBody, err := json.Marshal(SessionRequest{
		MinimumProtocolVersion: ProtocolVersion,
		MaximumProtocolVersion: ProtocolVersion,
		Features:               ProtocolFeatures(),
		HostSessionID:          "00000000-0000-4000-8000-000000000012",
	})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, SessionPath, strings.NewReader(string(requestBody)))
	request.Header.Set(ControlTokenHeader, store.Snapshot().ControlAuthToken)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("session response = %d: %s", response.Code, response.Body.String())
	}
	var negotiated SessionResponse
	if err := json.Unmarshal(response.Body.Bytes(), &negotiated); err != nil {
		t.Fatal(err)
	}
	if negotiated.BuildDigest != "sha256:startup-digest" {
		t.Fatalf("session build digest = %q, want the digest computed at startup", negotiated.BuildDigest)
	}
	if err := VerifyGuestSessionResponse(negotiated); err != nil {
		t.Fatalf("session signature does not cover the startup build digest: %v", err)
	}
}

func controlTestStore(t *testing.T) *guestconfig.Store {
	t.Helper()
	cfg := guestconfig.Defaults()
	cfg.InstanceID = "00000000-0000-4000-8000-000000000002"
	cfg.GenerationID = "generation-1"
	cfg.GuestServiceTokens = map[string]string{"test-service": strings.Repeat("a", 64)}
	cfg.ControlAuthToken = strings.Repeat("b", 64)
	data, err := toml.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "guest-init.toml")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := guestconfig.OpenStore(path)
	if err != nil {
		t.Fatal(err)
	}
	return store
}

type testSessionResetter struct{}

func (testSessionResetter) ResetSessions() error { return nil }

func withServiceCredentialRoot(path string) ServerOption {
	return func(server *Server) error {
		server.credentialRoot = filepath.Clean(path)
		return nil
	}
}
