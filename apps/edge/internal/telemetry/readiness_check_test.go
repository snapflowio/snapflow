// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package telemetry

import (
	"net/http/httptest"
	"testing"
)

func TestCheckReadinessFollowsServingReadiness(t *testing.T) {
	t.Parallel()
	source := &mutableSource{
		snapshot: Snapshot{ServingReady: servingReadyValue},
	}
	server, err := NewServer(Config{ListenAddress: "127.0.0.1:0"}, source)
	if err != nil {
		t.Fatalf("create metrics server: %v", err)
	}
	listener := httptest.NewServer(server.handler)
	address := listener.Listener.Addr().String()
	if err := CheckReadiness(t.Context(), address); err != nil {
		t.Fatalf("ready edge failed readiness check: %v", err)
	}

	source.snapshot.ServingReady = 0
	if err := CheckReadiness(t.Context(), address); err == nil {
		t.Fatal("unready edge passed readiness check")
	}

	listener.Close()
	if err := CheckReadiness(t.Context(), address); err == nil {
		t.Fatal("stopped edge passed readiness check")
	}
}
