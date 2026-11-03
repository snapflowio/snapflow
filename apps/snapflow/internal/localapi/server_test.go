// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package localapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/snapflowio/snapflow/internal/readiness"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
)

const (
	testConnectionToken = "connection-token"
	testVersion         = "v9.9.9-test"
	testSnapshotCount   = 3
	ephemeralPort       = 0
	testRunDeadline     = 5 * time.Second
)

type staticMetrics struct{}

func (staticMetrics) Collect(context.Context) (*readiness.HostMetrics, error) {
	return &readiness.HostMetrics{SnapshotCount: testSnapshotCount}, nil
}

type staticRuntime struct{}

func (staticRuntime) Health(context.Context) []sandboxruntime.ServiceHealth {
	return []sandboxruntime.ServiceHealth{{Name: "microvm", Healthy: false, Error: errors.New("KVM unavailable")}}
}

func newTestServer(t *testing.T) *Server {
	t.Helper()
	server, err := New(
		Config{Port: ephemeralPort, Version: testVersion},
		Dependencies{
			ConnectionToken: testConnectionToken,
			Registry:        prometheus.NewRegistry(),
			Metrics:         staticMetrics{},
			Runtime:         staticRuntime{},
		},
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	return server
}

func serve(t *testing.T, server *Server, path, token string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	recorder := httptest.NewRecorder()
	server.router().ServeHTTP(recorder, request)
	return recorder
}

func TestHealthCheckIsPublic(t *testing.T) {
	if recorder := serve(t, newTestServer(t), "/", ""); recorder.Code != http.StatusOK {
		t.Fatalf("GET / = %d, want 200", recorder.Code)
	}
}

func TestProtectedRoutesRequireConnectionToken(t *testing.T) {
	server := newTestServer(t)
	for _, path := range []string{machineInfoRoute, metricsRoute} {
		if recorder := serve(t, server, path, ""); recorder.Code != http.StatusUnauthorized {
			t.Fatalf("GET %s without a token = %d, want 401", path, recorder.Code)
		}
		if recorder := serve(t, server, path, testConnectionToken); recorder.Code != http.StatusOK {
			t.Fatalf("GET %s with a token = %d, want 200", path, recorder.Code)
		}
	}
}

func TestMachineInfoReportsMetricsAndServiceHealth(t *testing.T) {
	recorder := serve(t, newTestServer(t), machineInfoRoute, testConnectionToken)
	var response MachineInfoResponseDTO
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode machine info: %v", err)
	}
	if response.Metrics == nil || response.Metrics.CurrentSnapshotCount != testSnapshotCount || response.AppVersion != testVersion {
		t.Fatalf("machine info = %+v", response)
	}
	if len(response.ServiceHealth) != 1 || response.ServiceHealth[0].Healthy || response.ServiceHealth[0].ErrorReason == nil {
		t.Fatalf("machine info service health = %+v", response.ServiceHealth)
	}
}

func TestRunStopsOnCancellationAndCloseIsIdempotent(t *testing.T) {
	server := newTestServer(t)
	if err := server.Prepare(t.Context()); err != nil {
		t.Fatalf("Prepare() error = %v", err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	result := make(chan error, 1)
	go func() { result <- server.Run(ctx) }()
	cancel()
	select {
	case err := <-result:
		if err != nil {
			t.Fatalf("Run() error = %v", err)
		}
	case <-time.After(testRunDeadline):
		t.Fatal("Run did not stop after cancellation")
	}
	if err := server.Close(); err != nil {
		t.Fatalf("Close() after Run = %v", err)
	}
	if err := server.Close(); err != nil {
		t.Fatalf("second Close() = %v", err)
	}
}
