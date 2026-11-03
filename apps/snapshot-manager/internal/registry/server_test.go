// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"errors"
	"log/slog"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/snapflowio/common-go/pkg/httpserver"
)

const (
	testDrainTimeout      = 50 * time.Millisecond
	testDrainBound        = 5 * time.Second
	loopbackNetwork       = "tcp"
	loopbackListenAddress = "127.0.0.1:0"
	slowRequestPath       = "/slow"
)

func TestServerAppliesConnectionTimeouts(t *testing.T) {
	t.Parallel()

	srv, err := New(testConfig(t), WithLogger(slog.New(slog.DiscardHandler)))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if srv.http.ReadHeaderTimeout != httpserver.ReadHeaderTimeout {
		t.Fatalf("ReadHeaderTimeout = %s, want %s", srv.http.ReadHeaderTimeout, httpserver.ReadHeaderTimeout)
	}
	if srv.http.IdleTimeout != httpserver.IdleTimeout {
		t.Fatalf("IdleTimeout = %s, want %s", srv.http.IdleTimeout, httpserver.IdleTimeout)
	}
}

func TestDrainClosesRequestsThatOutliveTheDrainTimeout(t *testing.T) {
	t.Parallel()

	srv, err := New(testConfig(t), WithLogger(slog.New(slog.DiscardHandler)))
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	entered := make(chan struct{})
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	srv.http.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(entered)
		select {
		case <-r.Context().Done():
		case <-release:
		}
		w.WriteHeader(http.StatusNoContent)
	})
	listener, err := (&net.ListenConfig{}).Listen(t.Context(), loopbackNetwork, loopbackListenAddress)
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	served := make(chan error, 1)
	go func() { served <- srv.http.Serve(listener) }()

	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://"+listener.Addr().String()+slowRequestPath, http.NoBody)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	responded := make(chan error, 1)
	go func() {
		response, doErr := http.DefaultClient.Do(request)
		if doErr == nil {
			doErr = response.Body.Close()
		}
		responded <- doErr
	}()
	<-entered

	started := time.Now()
	if err := srv.Drain(t.Context()); err != nil {
		t.Fatalf("Drain() error = %v", err)
	}
	if elapsed := time.Since(started); elapsed > testDrainBound {
		t.Fatalf("Drain() took %s, want at most %s", elapsed, testDrainBound)
	}
	if err := <-served; !errors.Is(err, http.ErrServerClosed) {
		t.Fatalf("Serve() error = %v, want %v", err, http.ErrServerClosed)
	}
	if err := <-responded; err == nil {
		t.Fatal("in-flight request completed, want it cut off by the drain timeout")
	}
}
