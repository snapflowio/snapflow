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

package runtime

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"maps"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/internal/guest/control"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/vsock"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

const restoreTestToolboxPort = 2280

type vsockProxyListener struct {
	net.Listener
}

func (l vsockProxyListener) Accept() (net.Conn, error) {
	for {
		connection, err := l.Listener.Accept()
		if err != nil {
			return nil, err
		}
		if _, err := bufio.NewReader(connection).ReadString('\n'); err != nil {
			_ = connection.Close()
			continue
		}
		if _, err := io.WriteString(connection, "OK 1073741824\n"); err != nil {
			_ = connection.Close()
			continue
		}
		return connection, nil
	}
}

type snapshotToolbox struct {
	healthy atomic.Bool
	probes  atomic.Int64
}

func (t *snapshotToolbox) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	t.probes.Add(1)
	if request.URL.Path != "/version" || !t.healthy.Load() {
		writer.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	writer.WriteHeader(http.StatusOK)
}

func serveSnapshotToolbox(t *testing.T, toolbox *snapshotToolbox) string {
	t.Helper()
	directory, err := os.MkdirTemp("", "vsock")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.RemoveAll(directory); err != nil {
			t.Error(err)
		}
	})
	socket := filepath.Join(directory, "v.sock")
	listener, err := new(net.ListenConfig).Listen(t.Context(), "unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: toolbox, ReadHeaderTimeout: time.Second}
	served := make(chan error, 1)
	go func() { served <- server.Serve(vsockProxyListener{Listener: listener}) }()
	t.Cleanup(func() {
		if err := server.Close(); err != nil {
			t.Error(err)
		}
		if err := <-served; !errors.Is(err, http.ErrServerClosed) {
			t.Error(err)
		}
	})
	return socket
}

type recordingWorkloadControl struct {
	mu      sync.Mutex
	calls   []string
	toolbox *snapshotToolbox
}

func (c *recordingWorkloadControl) WorkloadReady(context.Context) error {
	if c.toolbox.probes.Load() == 0 {
		c.record("workload-ready-before-guest-services")
		return errors.New("workload readiness checked before guest services were confirmed")
	}
	c.record("workload-ready")
	return nil
}

func (c *recordingWorkloadControl) record(call string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.calls = append(c.calls, call)
}

func (c *recordingWorkloadControl) recorded() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return slices.Clone(c.calls)
}

func restoreTestMetadata(socket string) state.InstanceMetadata {
	return state.InstanceMetadata{
		ID:           "6f0b5d4e-7a0c-4d61-9a43-3f6d3d0c5a11",
		GenerationID: "generation-1",
		TemplateKey:  "template-key",
		VsockSocket:  socket,
		GuestServices: []guest.Service{{
			Name:       "toolbox",
			Port:       restoreTestToolboxPort,
			HealthPath: "/version",
		}},
	}
}

func restoreTestInitialization(metadata state.InstanceMetadata) *types.WorkloadInitialization {
	return &types.WorkloadInitialization{
		InstanceID:   metadata.ID,
		GenerationID: metadata.GenerationID,
		OSUser:       "snapflow",
		Env:          map[string]string{"APP_MODE": "test"},
		SecretEnv:    map[string]string{"API_TOKEN": "secret"},
		Entrypoint:   []string{"/bin/app"},
	}
}

func TestCompleteRestoredGuestConfirmsServicesThenWorkload(t *testing.T) {
	toolbox := &snapshotToolbox{}
	toolbox.healthy.Store(true)
	metadata := restoreTestMetadata(serveSnapshotToolbox(t, toolbox))
	backend := &Backend{paths: layout.NewPaths(t.TempDir())}
	client := &recordingWorkloadControl{toolbox: toolbox}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	timings, err := backend.completeRestoredGuest(ctx, &metadata, client)
	if err != nil {
		t.Fatalf("completeRestoredGuest() error = %v", err)
	}
	if calls := client.recorded(); !slices.Equal(calls, []string{"workload-ready"}) {
		t.Fatalf("guest control calls = %v, want only workload-ready after services", calls)
	}
	if timings.workloadReadyAt.Before(timings.servicesReadyAt) {
		t.Fatalf("restore phases are out of order: %+v", timings)
	}
}

func TestCompleteRestoredGuestFailsWithoutSnapshotServices(t *testing.T) {
	toolbox := &snapshotToolbox{}
	metadata := restoreTestMetadata(serveSnapshotToolbox(t, toolbox))
	backend := &Backend{paths: layout.NewPaths(t.TempDir())}
	client := &recordingWorkloadControl{toolbox: toolbox}
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()

	if _, err := backend.completeRestoredGuest(ctx, &metadata, client); err == nil {
		t.Fatal("restore succeeded although the snapshot toolbox was unavailable")
	}
	if calls := client.recorded(); len(calls) != 0 {
		t.Fatalf("guest control calls = %v, want none before services are confirmed", calls)
	}
}

func TestRestoredWorkloadRequestCarriesTheInitialization(t *testing.T) {
	metadata := restoreTestMetadata("")
	initialization := restoreTestInitialization(metadata)

	request, err := restoredWorkloadRequest(metadata, initialization)
	if err != nil {
		t.Fatalf("restoredWorkloadRequest() error = %v", err)
	}
	if request.InstanceID != metadata.ID || request.GenerationID != metadata.GenerationID || request.OSUser != "snapflow" ||
		!maps.Equal(request.Env, initialization.Env) || !maps.Equal(request.SecretEnv, initialization.SecretEnv) ||
		!slices.Equal(request.Entrypoint, initialization.Entrypoint) {
		t.Fatalf("restore workload request = %+v, want the start initialization", request)
	}
	if none, err := restoredWorkloadRequest(metadata, nil); err != nil || none != nil {
		t.Fatalf("restore without initialization = %v, %v; want none", none, err)
	}
	mismatched := restoreTestInitialization(metadata)
	mismatched.GenerationID = "generation-2"
	if _, err := restoredWorkloadRequest(metadata, mismatched); err == nil {
		t.Fatal("an initialization for another generation was accepted")
	}
}

func TestRestoreReachedWorkloadOnlyAfterTheGuestStartedIt(t *testing.T) {
	step := func(name string) error {
		return &guest.ControlProblem{Code: "GUEST_RESTORE_STEP_FAILED", Details: &guest.ControlProblemDetails{Step: name}}
	}
	cases := map[string]struct {
		err  error
		want bool
	}{
		"succeeded":           {nil, true},
		"guest not listening": {fmt.Errorf("dial: %w", vsock.ErrHandshakeClosed), false},
		"handshake timed out": {fmt.Errorf("dial: %w", vsock.ErrHandshakeTimeout), false},
		"rejected credential": {&guest.ControlProblem{Code: "CONTROL_CREDENTIAL_INVALID"}, false},
		"invalid request":     {step(control.RestoreStepRequest), false},
		"identity failed":     {step(control.RestoreStepIdentity), false},
		"resume failed":       {step(control.RestoreStepResume), false},
		"workload failed":     {step(control.RestoreStepWorkload), true},
		"session failed":      {step(control.RestoreStepSession), true},
		"response lost":       {errors.New("connection reset by peer"), true},
	}
	for name, testCase := range cases {
		if got := restoreReachedWorkload(testCase.err); got != testCase.want {
			t.Fatalf("%s: restoreReachedWorkload() = %v, want %v", name, got, testCase.want)
		}
	}
}

func TestRestoreWorkloadInitialization(t *testing.T) {
	metadata := restoreTestMetadata("")
	initialization := restoreTestInitialization(metadata)

	if _, err := restoreWorkloadInitialization(metadata, types.StartOptions{}); err == nil {
		t.Fatal("uninitialized template restore without initialization was accepted")
	}
	selected, err := restoreWorkloadInitialization(metadata, types.StartOptions{Initialization: initialization})
	if err != nil || selected != initialization {
		t.Fatalf("restoreWorkloadInitialization() = %v, %v; want the start initialization", selected, err)
	}
	metadata.WorkloadInitialized = true
	if selected, err := restoreWorkloadInitialization(metadata, types.StartOptions{}); err != nil || selected != nil {
		t.Fatalf("initialized template restore = %v, %v; want no initialization", selected, err)
	}
	metadata.TemplateKey = ""
	metadata.WorkloadInitialized = false
	if selected, err := restoreWorkloadInitialization(metadata, types.StartOptions{}); err != nil || selected != nil {
		t.Fatalf("standby restore = %v, %v; want no initialization", selected, err)
	}
}

func TestWaitForGuestServicesReadyRequiresServicesInTemplateSeeds(t *testing.T) {
	toolbox := &snapshotToolbox{}
	metadata := restoreTestMetadata(serveSnapshotToolbox(t, toolbox))
	metadata.TemplateSeed = true
	backend := &Backend{paths: layout.NewPaths(t.TempDir())}

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	if err := backend.waitForGuestServicesReady(ctx, metadata); err == nil {
		t.Fatal("template seed was accepted before its toolbox was serving")
	}
	toolbox.healthy.Store(true)
	if err := backend.waitForGuestServicesReady(context.Background(), metadata); err != nil {
		t.Fatalf("template seed guest service wait error = %v", err)
	}
}
