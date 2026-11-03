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

//go:build linux

package guestinit

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/guest"
)

type recordingLifecycleComponent struct {
	mu        sync.Mutex
	workloads []guest.Workload
}

func (c *recordingLifecycleComponent) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.URL.Path != guest.LifecycleOperationPath(guest.LifecycleOperationWorkload) {
		writer.WriteHeader(http.StatusNotFound)
		return
	}
	var workload guest.Workload
	if err := json.NewDecoder(request.Body).Decode(&workload); err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}
	c.mu.Lock()
	c.workloads = append(c.workloads, workload)
	c.mu.Unlock()
	writer.WriteHeader(http.StatusNoContent)
}

func (c *recordingLifecycleComponent) received() []guest.Workload {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]guest.Workload(nil), c.workloads...)
}

func serveLifecycleComponent(t *testing.T, component http.Handler) string {
	t.Helper()
	directory, err := os.MkdirTemp("", "lifecycle")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.RemoveAll(directory); err != nil {
			t.Error(err)
		}
	})
	socket := filepath.Join(directory, "core.sock")
	listener, err := new(net.ListenConfig).Listen(t.Context(), "unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: component, ReadHeaderTimeout: time.Second}
	served := make(chan error, 1)
	go func() { served <- server.Serve(listener) }()
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

func TestPlatformComponentWorkloadCombinesRuntimeAndSourcedEnvironment(t *testing.T) {
	cfg := &Config{
		Workdir: "/workspace",
		OSUser:  "snapflow",
		Env:     map[string]string{"APP_MODE": "test", "": "ignored", "BROKEN=NAME": "ignored"},
	}
	manifest := guest.Manifest{
		Name: "core",
		EnvSources: map[string]guest.EnvironmentSource{
			"SNAPFLOW_DESKTOP_PROJECT_DIR": guest.EnvironmentSourceSandboxWorkdir,
			"SNAPFLOW_SANDBOX_USER":        guest.EnvironmentSourceSandboxOSUser,
		},
	}

	workload, err := platformComponentWorkload(cfg, manifest)
	if err != nil {
		t.Fatalf("platformComponentWorkload() error = %v", err)
	}
	want := map[string]string{
		"APP_MODE":                     "test",
		"SNAPFLOW_DESKTOP_PROJECT_DIR": "/workspace",
		"SNAPFLOW_SANDBOX_USER":        "snapflow",
	}
	if !maps.Equal(workload.Env, want) {
		t.Fatalf("workload environment = %v, want %v", workload.Env, want)
	}
}

func TestPlatformComponentWorkloadRejectsUnknownSource(t *testing.T) {
	manifest := guest.Manifest{Name: "core", EnvSources: map[string]guest.EnvironmentSource{"VALUE": "unknown"}}
	if _, err := platformComponentWorkload(&Config{}, manifest); err == nil {
		t.Fatal("unknown environment source was accepted")
	}
}

func TestRunningPlatformComponentRedeliversTheLastWorkloadAfterRestart(t *testing.T) {
	recorder := &recordingLifecycleComponent{}
	socket := serveLifecycleComponent(t, recorder)
	component := &runningPlatformComponent{manifest: guest.Manifest{Name: "core", LifecycleSocket: socket, Capabilities: []guest.Capability{guest.CapabilityWorkloadInit}}}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := component.redeliverWorkload(ctx); err != nil {
		t.Fatalf("redeliver before any workload error = %v", err)
	}
	if received := recorder.received(); len(received) != 0 {
		t.Fatalf("component received %v before the workload was configured", received)
	}
	workload := guest.Workload{Env: map[string]string{"APP_MODE": "test"}}
	if err := component.deliverWorkload(ctx, workload); err != nil {
		t.Fatalf("deliverWorkload() error = %v", err)
	}
	if err := component.redeliverWorkload(ctx); err != nil {
		t.Fatalf("redeliverWorkload() error = %v", err)
	}
	received := recorder.received()
	if len(received) != 2 || !maps.Equal(received[0].Env, workload.Env) || !maps.Equal(received[1].Env, workload.Env) {
		t.Fatalf("component received %v, want the workload delivered and redelivered", received)
	}
}

func TestRunningPlatformComponentRefusesComponentsWithoutTheWorkloadCapability(t *testing.T) {
	recorder := &recordingLifecycleComponent{}
	socket := serveLifecycleComponent(t, recorder)
	component := &runningPlatformComponent{manifest: guest.Manifest{
		Name: "core", LifecycleSocket: socket,
		Capabilities: []guest.Capability{guest.CapabilityForkIdentity},
	}}

	if err := component.deliverWorkload(context.Background(), guest.Workload{Env: map[string]string{}}); err == nil {
		t.Fatal("workload was delivered to a component that does not declare workload initialization")
	}
	if received := recorder.received(); len(received) != 0 {
		t.Fatalf("component received %v without the workload capability", received)
	}
}

func TestRunningPlatformComponentReportsRejectedWorkload(t *testing.T) {
	socket := serveLifecycleComponent(t, http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusInternalServerError)
	}))
	component := &runningPlatformComponent{manifest: guest.Manifest{Name: "core", LifecycleSocket: socket, Capabilities: []guest.Capability{guest.CapabilityWorkloadInit}}}

	if err := component.deliverWorkload(context.Background(), guest.Workload{Env: map[string]string{}}); err == nil {
		t.Fatal("a component that rejected its workload was reported as configured")
	}
}
