// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package lifecycle

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/snapflowio/common-go/pkg/guestspec"
)

func startTestServer(t *testing.T) (string, *http.Client) {
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
	socket := filepath.Join(directory, "components", "core.sock")
	server := New(slog.New(slog.DiscardHandler), socket)
	ctx, cancel := context.WithCancel(context.Background())
	listener, err := server.listen(ctx)
	if err != nil {
		cancel()
		t.Fatalf("listen() error = %v", err)
	}
	served := make(chan error, 1)
	go func() { served <- server.serve(ctx, listener) }()
	client := &http.Client{Transport: &http.Transport{DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
		return (&net.Dialer{Timeout: time.Second}).DialContext(ctx, socketNetwork, socket)
	}}}
	t.Cleanup(func() {
		client.CloseIdleConnections()
		cancel()
		if err := <-served; err != nil {
			t.Error(err)
		}
	})
	return socket, client
}

func post(t *testing.T, client *http.Client, path string, payload any) int {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request, err := http.NewRequestWithContext(t.Context(), http.MethodPost, "http://component.internal"+path, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create %s request: %v", path, err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("post %s: %v", path, err)
	}
	if err := response.Body.Close(); err != nil {
		t.Fatal(err)
	}
	return response.StatusCode
}

func TestWorkloadEnvironmentIsAppliedToTheDaemonProcess(t *testing.T) {
	t.Setenv("LIFECYCLE_TEST_KEPT", "")
	t.Setenv("LIFECYCLE_TEST_REMOVED", "")
	socket, client := startTestServer(t)
	info, err := os.Stat(socket)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("lifecycle socket mode = %v, want 0600", info.Mode().Perm())
	}

	first := guestspec.Workload{Env: map[string]string{"LIFECYCLE_TEST_KEPT": "one", "LIFECYCLE_TEST_REMOVED": "gone soon"}}
	if status := post(t, client, guestspec.LifecycleWorkloadPath, first); status != http.StatusNoContent {
		t.Fatalf("workload status = %d, want 204", status)
	}
	if os.Getenv("LIFECYCLE_TEST_KEPT") != "one" || os.Getenv("LIFECYCLE_TEST_REMOVED") != "gone soon" {
		t.Fatal("workload environment was not applied to the daemon process")
	}

	second := guestspec.Workload{Env: map[string]string{"LIFECYCLE_TEST_KEPT": "two"}}
	if status := post(t, client, guestspec.LifecycleWorkloadPath, second); status != http.StatusNoContent {
		t.Fatalf("second workload status = %d, want 204", status)
	}
	if os.Getenv("LIFECYCLE_TEST_KEPT") != "two" {
		t.Fatal("updated workload value was not applied")
	}
	if _, present := os.LookupEnv("LIFECYCLE_TEST_REMOVED"); present {
		t.Fatal("a variable missing from the new workload stayed in the daemon environment")
	}
}

func TestInvalidWorkloadIsRejectedWithoutChangingTheEnvironment(t *testing.T) {
	t.Setenv("LIFECYCLE_TEST_UNCHANGED", "original")
	_, client := startTestServer(t)

	invalid := guestspec.Workload{Env: map[string]string{"BROKEN=NAME": "x", "LIFECYCLE_TEST_UNCHANGED": "changed"}}
	if status := post(t, client, guestspec.LifecycleWorkloadPath, invalid); status != http.StatusBadRequest {
		t.Fatalf("invalid workload status = %d, want 400", status)
	}
	if os.Getenv("LIFECYCLE_TEST_UNCHANGED") != "original" {
		t.Fatal("a rejected workload changed the daemon environment")
	}
	if status := post(t, client, guestspec.LifecycleWorkloadPath, map[string]any{"env": map[string]string{}, "unexpected": true}); status != http.StatusBadRequest {
		t.Fatalf("workload with unknown fields status = %d, want 400", status)
	}
}

func TestOnlyTheWorkloadOperationIsServed(t *testing.T) {
	_, client := startTestServer(t)
	for _, path := range []string{"/v1/identity", "/v1/quiesce", "/v1/resume"} {
		if status := post(t, client, path, map[string]string{"instanceId": "instance"}); status != http.StatusNotFound {
			t.Fatalf("%s status = %d, want 404 for an operation the daemon does not declare", path, status)
		}
	}
}

func TestListenReplacesStaleSocketButRefusesOtherFiles(t *testing.T) {
	directory, err := os.MkdirTemp("", "lifecycle")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.RemoveAll(directory); err != nil {
			t.Error(err)
		}
	})
	regular := filepath.Join(directory, "regular")
	if err := os.WriteFile(regular, []byte("not a socket"), 0o600); err != nil {
		t.Fatal(err)
	}
	if listener, err := New(slog.New(slog.DiscardHandler), regular).listen(context.Background()); err == nil {
		t.Fatalf("listen replaced a regular file with %v", listener.Addr())
	}

	socket := filepath.Join(directory, "stale.sock")
	stale, err := net.ListenUnix("unix", &net.UnixAddr{Name: socket, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	stale.SetUnlinkOnClose(false)
	if err := stale.Close(); err != nil {
		t.Fatal(err)
	}
	listener, err := New(slog.New(slog.DiscardHandler), socket).listen(context.Background())
	if err != nil {
		t.Fatalf("listen() over a stale socket error = %v", err)
	}
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
}
