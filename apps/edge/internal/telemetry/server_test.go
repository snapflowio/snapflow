// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServerSeparatesMetricsLivenessAndReadiness(t *testing.T) {
	t.Parallel()
	source := &mutableSource{
		snapshot: Snapshot{ServingReady: 1},
	}
	server, err := NewServer(Config{ListenAddress: "127.0.0.1:0"}, source)
	if err != nil {
		t.Fatalf("create metrics server: %v", err)
	}
	assertStatus(t, server.handler, "/healthz", http.StatusNoContent)
	assertStatus(t, server.handler, "/readyz", http.StatusNoContent)
	assertStatus(t, server.handler, "/metrics", http.StatusOK)
	assertStatus(t, server.handler, "/unknown", http.StatusNotFound)

	source.snapshot.ServingReady = 0
	assertStatus(t, server.handler, "/healthz", http.StatusNoContent)
	assertStatus(t, server.handler, "/readyz", http.StatusServiceUnavailable)
}

type mutableSource struct {
	snapshot Snapshot
}

func (source *mutableSource) Snapshot() Snapshot {
	return source.snapshot
}

func assertStatus(
	t *testing.T,
	handler http.Handler,
	path string,
	expected int,
) {
	t.Helper()
	response := httptest.NewRecorder()
	handler.ServeHTTP(
		response,
		httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil),
	)
	if response.Code != expected {
		t.Fatalf("%s status = %d, want %d", path, response.Code, expected)
	}
}
