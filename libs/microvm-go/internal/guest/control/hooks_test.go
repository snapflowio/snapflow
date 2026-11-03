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
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/guest"
)

type recordingHookComponent struct {
	mu    sync.Mutex
	paths []string
}

func (c *recordingHookComponent) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	c.mu.Lock()
	c.paths = append(c.paths, request.URL.Path)
	c.mu.Unlock()
	writer.WriteHeader(http.StatusNoContent)
}

func (c *recordingHookComponent) received() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return slices.Clone(c.paths)
}

func serveHookComponent(t *testing.T, component http.Handler) string {
	t.Helper()
	directory, err := os.MkdirTemp("", "hooks")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.RemoveAll(directory); err != nil {
			t.Error(err)
		}
	})
	socket := filepath.Join(directory, "component.sock")
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

func TestComponentHooksReachOnlyComponentsThatDeclareTheOperation(t *testing.T) {
	workloadOnly := &recordingHookComponent{}
	identityAware := &recordingHookComponent{}
	hooks := []guest.LifecycleHook{
		{Name: "core", SocketPath: serveHookComponent(t, workloadOnly), Operations: []guest.LifecycleOperation{guest.LifecycleOperationWorkload}},
		{Name: "extension", SocketPath: serveHookComponent(t, identityAware), Operations: []guest.LifecycleOperation{guest.LifecycleOperationIdentity}},
	}

	if err := callComponentHooks(context.Background(), hooks, guest.LifecycleOperationIdentity, guest.Identity{InstanceID: "next"}); err != nil {
		t.Fatalf("callComponentHooks() error = %v", err)
	}
	if received := workloadOnly.received(); len(received) != 0 {
		t.Fatalf("workload-only component received %v during identity rotation", received)
	}
	if received := identityAware.received(); !slices.Equal(received, []string{guest.LifecycleOperationPath(guest.LifecycleOperationIdentity)}) {
		t.Fatalf("identity-aware component received %v", received)
	}
}

func TestNotifyComponentRejectsUndeclaredOperations(t *testing.T) {
	component := &recordingHookComponent{}
	hook := guest.LifecycleHook{Name: "core", SocketPath: serveHookComponent(t, component), Operations: []guest.LifecycleOperation{guest.LifecycleOperationWorkload}}

	if err := NotifyComponent(context.Background(), hook, guest.LifecycleOperationIdentity, guest.Identity{InstanceID: "next"}); err == nil {
		t.Fatal("an undeclared lifecycle operation was delivered")
	}
	if err := NotifyComponent(context.Background(), hook, guest.LifecycleOperationWorkload, guest.Workload{Env: map[string]string{}}); err != nil {
		t.Fatalf("NotifyComponent(workload) error = %v", err)
	}
	if received := component.received(); !slices.Equal(received, []string{guest.LifecycleOperationPath(guest.LifecycleOperationWorkload)}) {
		t.Fatalf("component received %v, want only the workload", received)
	}
}
