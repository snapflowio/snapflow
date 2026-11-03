// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package update

import (
	"context"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/snapflowio/snapflow/internal/control"
	"github.com/snapflowio/snapflow/internal/control/controltest"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	identityStatusAPI   = controltest.APIPrefix + "/machines/identity/status"
	testPollInterval    = 10 * time.Millisecond
	testReadinessWindow = 5 * time.Second
	testFailureReason   = "guest release unavailable"
	testCreatedAt       = "2026-01-01T00:00:00Z"
)

func testMachine(state apiclient.MachineState) *apiclient.Machine {
	return &apiclient.Machine{
		Id: controltest.MachineID, Cpu: 1, Memory: 1, Disk: 1, Name: "machine", State: state,
		CreatedAt: testCreatedAt, UpdatedAt: testCreatedAt, ApiVersion: "v1",
	}
}

func readinessServer(t *testing.T, unavailable int32, machine *apiclient.Machine) (*control.Client, *atomic.Int32) {
	t.Helper()
	var requests atomic.Int32
	client := controltest.NewClient(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != identityStatusAPI {
			t.Errorf("unexpected request path %q", request.URL.Path)
		}
		if request.Header.Get("Authorization") != "" {
			t.Error("identity status request carried a session token")
		}
		if requests.Add(1) <= unavailable {
			writer.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		controltest.WriteJSON(t, writer, http.StatusOK, machine)
	}))
	return client, &requests
}

func waitForReadiness(t *testing.T, client *control.Client) error {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), testReadinessWindow)
	defer cancel()
	return WaitForReadiness(ctx, client, controltest.MachineID, testPollInterval)
}

func TestWaitForReadinessRetriesUnavailableControlPlane(t *testing.T) {
	client, requests := readinessServer(t, 2, testMachine(apiclient.MachineStateReady))
	if err := waitForReadiness(t, client); err != nil {
		t.Fatalf("WaitForReadiness() error = %v", err)
	}
	if got := requests.Load(); got != 3 {
		t.Fatalf("readiness was polled %d times, want 3", got)
	}
}

func TestWaitForReadinessReportsFailedMachine(t *testing.T) {
	failed := testMachine(apiclient.MachineStateFailed)
	failureReason := testFailureReason
	failed.ReadinessReason = &failureReason
	client, _ := readinessServer(t, 0, failed)
	if err := waitForReadiness(t, client); err == nil || !strings.Contains(err.Error(), testFailureReason) {
		t.Fatalf("WaitForReadiness() error = %v, want the readiness failure", err)
	}
}

func TestApiUpdateStatusRejectsUnknownPhase(t *testing.T) {
	if _, err := apiUpdateStatus(Status{Phase: Phase("unknown")}); err == nil {
		t.Fatal("apiUpdateStatus accepted an unknown phase")
	}
}
