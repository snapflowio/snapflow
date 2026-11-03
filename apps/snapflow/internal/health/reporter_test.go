// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package health

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"testing"
	"time"

	"github.com/snapflowio/snapflow/internal/control/controltest"
	"github.com/snapflowio/snapflow/internal/readiness"
	sandboxruntime "github.com/snapflowio/snapflow/internal/runtime"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const (
	healthcheckAPI   = controltest.APIPrefix + "/machines/healthcheck"
	testInterval     = time.Minute
	testTimeout      = 5 * time.Second
	testReason       = "the runtime is unavailable"
	testHostKey      = "ssh-ed25519 AAAA"
	testReleaseName  = "v1.2.3"
	testVersion      = "v9.9.9-test"
	testCPUCapacity  = 8
	testDiskCapacity = 24
	testBuilder      = "moby/buildkit:test"
	testInventory    = "99f61e99f65dae0fd737080e6329c8fa95a212a3a89c19786e15b04eb4f12818"
)

type staticRuntime struct{}

func (staticRuntime) Health(context.Context) []sandboxruntime.ServiceHealth {
	return []sandboxruntime.ServiceHealth{{Name: "microvm", Healthy: true}}
}

func (staticRuntime) Capabilities(context.Context) (sandboxruntime.Capabilities, error) {
	return sandboxruntime.Capabilities{
		KVMAvailable: true, Hypervisors: []string{string(apiclient.MachineHypervisorFirecracker)}, Features: []string{string(apiclient.MachineRuntimeFeaturePause)},
		MachineReleaseVersion: testReleaseName, BuilderImage: testBuilder,
	}, nil
}

type staticMetrics struct{}

func (staticMetrics) Collect(context.Context) (*readiness.HostMetrics, error) {
	return &readiness.HostMetrics{CPUCapacity: testCPUCapacity, DiskCapacityGiB: testDiskCapacity}, nil
}

func staticInventory(context.Context) (*machinev1alpha1.HostInventory, error) {
	return &machinev1alpha1.HostInventory{InventoryDigest: testInventory}, nil
}

func capture(t *testing.T, observed *apiclient.MachineHealthcheck) http.HandlerFunc {
	t.Helper()
	return func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != healthcheckAPI {
			t.Errorf("unexpected request path %q", request.URL.Path)
		}
		controltest.DecodeJSON(t, request, observed)
		writer.WriteHeader(http.StatusNoContent)
	}
}

func TestReportReadyPublishesFullPayload(t *testing.T) {
	var observed apiclient.MachineHealthcheck
	service, err := New(
		Config{Interval: testInterval, Timeout: testTimeout, SSHHostPublicKey: testHostKey, Version: testVersion},
		Dependencies{
			Client:    controltest.NewClient(t, capture(t, &observed)),
			Collector: staticMetrics{}, Runtime: staticRuntime{}, Inventory: staticInventory,
		},
		WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if err := service.ReportReady(t.Context()); err != nil {
		t.Fatalf("ReportReady() error = %v", err)
	}
	assertFullReadyPayload(t, observed)
}

func assertFullReadyPayload(t *testing.T, observed apiclient.MachineHealthcheck) {
	t.Helper()
	if observed.Readiness.State != apiclient.MachineReadinessStateReady || observed.SshHostPublicKey == nil || *observed.SshHostPublicKey != testHostKey || observed.AppVersion != testVersion {
		t.Fatalf("published readiness = %+v", observed.Readiness)
	}
	if observed.Metrics == nil || observed.Metrics.Cpu != testCPUCapacity || observed.Metrics.DiskGiB != testDiskCapacity || observed.ServiceHealth == nil || len(*observed.ServiceHealth) != 1 {
		t.Fatalf("published metrics or service health are missing: %+v", observed)
	}
	if observed.InventoryDigest == nil || *observed.InventoryDigest != testInventory {
		t.Fatalf("published inventory digest = %v, want %s", observed.InventoryDigest, testInventory)
	}
	if capabilities := observed.RuntimeCapabilities; capabilities == nil || capabilities.MachineReleaseVersion != testReleaseName || capabilities.BuilderImage != testBuilder {
		t.Fatalf("published capabilities = %+v", observed.RuntimeCapabilities)
	}
}

func TestReportReadinessPublishesState(t *testing.T) {
	var observed apiclient.MachineHealthcheck
	client := controltest.NewClient(t, capture(t, &observed))
	if err := ReportReadiness(t.Context(), client, testVersion, apiclient.MachineReadinessStateFailed, testReason); err != nil {
		t.Fatalf("ReportReadiness() error = %v", err)
	}
	if observed.Readiness.State != apiclient.MachineReadinessStateFailed || observed.AppVersion != testVersion {
		t.Fatalf("published state = %q", observed.Readiness.State)
	}
	if observed.Readiness.Reason == nil || *observed.Readiness.Reason != testReason {
		t.Fatalf("published reason = %v, want %s", observed.Readiness.Reason, testReason)
	}
}
