// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemontest

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/snapflowio/snapflow/internal/daemon"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const healthPath = "/"

func TestDaemonPublishesReadinessServesItsAPIAndDrains(t *testing.T) {
	environment := Start(t)

	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://"+environment.APIAddress+healthPath, http.NoBody)
	if err != nil {
		t.Fatalf("create machine API request: %v", err)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("GET machine API health: %v", err)
	}
	body, err := io.ReadAll(response.Body)
	if closeErr := response.Body.Close(); closeErr != nil {
		t.Fatalf("close machine API response: %v", closeErr)
	}
	if err != nil || response.StatusCode != http.StatusOK || !strings.Contains(string(body), Version) {
		t.Fatalf("machine API health = %d %q (%v)", response.StatusCode, body, err)
	}

	if err := environment.Shutdown(); err != nil {
		t.Fatalf("Shutdown() error = %v", err)
	}
	readiness := environment.ControlPlane.Readiness()
	if len(readiness) < 2 || readiness[0] != apiclient.MachineReadinessStateReady ||
		readiness[len(readiness)-1] != apiclient.MachineReadinessStateDraining {
		t.Fatalf("published readiness = %v (reasons %q), want ready first and draining last",
			readiness, environment.ControlPlane.ReadinessReasons())
	}
	if environment.ControlPlane.SessionOpen() {
		t.Fatal("machine session was not closed during shutdown")
	}
	if unhandled := environment.ControlPlane.Unhandled(); len(unhandled) != 0 {
		t.Fatalf("daemon made unexpected control-plane requests: %v", unhandled)
	}
	if err := environment.Daemon.Run(t.Context()); !errors.Is(err, daemon.ErrAlreadyStarted) {
		t.Fatalf("Run() after shutdown error = %v, want %v", err, daemon.ErrAlreadyStarted)
	}
}
