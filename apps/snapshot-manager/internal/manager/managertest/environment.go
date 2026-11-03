// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package managertest

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/snapshot-manager/internal/access/accesstest"
	"github.com/snapflowio/snapshot-manager/internal/manager"
	"github.com/snapflowio/snapshot-manager/internal/registry"
)

const (
	tcpNetwork              = "tcp"
	loopbackListenAddress   = "127.0.0.1:0"
	readinessTimeout        = 15 * time.Second
	readinessPollInterval   = 20 * time.Millisecond
	readinessRequestTimeout = 200 * time.Millisecond
	shutdownTimeout         = 30 * time.Second
	drainTimeout            = 5 * time.Second
	testVersion             = "managertest"
)

type Environment struct {
	Server       *manager.Server
	Config       manager.Config
	Tokens       *accesstest.TokenIssuer
	URL          string
	runResult    chan error
	shutdownOnce sync.Once
	shutdownErr  error
}

func Start(t *testing.T) *Environment {
	t.Helper()
	tokens := accesstest.NewIssuer(t)
	config := manager.Config{
		Profile:  deployment.Development,
		LogLevel: slog.LevelDebug,
		Registry: registry.Config{
			Addr:         freeAddress(t),
			Auth:         registry.Auth{JWKSURL: tokens.JWKSURL()},
			DrainTimeout: drainTimeout,
			Storage:      registry.Storage{Directory: t.TempDir()},
		},
	}
	server, err := manager.New(
		config,
		manager.WithLogger(slog.New(slog.DiscardHandler)),
		manager.WithVersion(testVersion),
	)
	if err != nil {
		t.Fatalf("create snapshot manager server: %v", err)
	}
	environment := &Environment{
		Server:    server,
		Config:    config,
		Tokens:    tokens,
		URL:       "http://" + config.Registry.Addr,
		runResult: make(chan error, 1),
	}
	go func() { environment.runResult <- server.Run(context.Background()) }()
	t.Cleanup(func() {
		if err := environment.Shutdown(); err != nil {
			t.Errorf("snapshot manager stopped with an error: %v", err)
		}
	})
	environment.awaitReady(t)
	return environment
}

func (environment *Environment) Shutdown() error {
	environment.shutdownOnce.Do(func() {
		ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := environment.Server.Shutdown(ctx); err != nil {
			environment.shutdownErr = err
			return
		}
		environment.shutdownErr = <-environment.runResult
	})
	return environment.shutdownErr
}

func (environment *Environment) awaitReady(t *testing.T) {
	t.Helper()
	client := &http.Client{Timeout: readinessRequestTimeout}
	deadline := time.Now().Add(readinessTimeout)
	for time.Now().Before(deadline) {
		select {
		case err := <-environment.runResult:
			environment.runResult <- err
			t.Fatalf("snapshot manager stopped before it became ready: %v", err)
		default:
		}
		if environment.healthy(t, client) {
			return
		}
		time.Sleep(readinessPollInterval)
	}
	t.Fatalf("snapshot manager did not become ready within %s", readinessTimeout)
}

func (environment *Environment) healthy(t *testing.T, client *http.Client) bool {
	t.Helper()
	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, environment.URL+registry.HealthPath, http.NoBody)
	if err != nil {
		t.Fatalf("create health request: %v", err)
	}
	response, err := client.Do(request)
	if err != nil {
		return false
	}
	if err := response.Body.Close(); err != nil {
		t.Fatalf("close health response: %v", err)
	}
	return response.StatusCode == http.StatusOK
}

func freeAddress(t *testing.T) string {
	t.Helper()
	listener, err := (&net.ListenConfig{}).Listen(t.Context(), tcpNetwork, loopbackListenAddress)
	if err != nil {
		t.Fatalf("reserve a loopback port: %v", err)
	}
	address := listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("release a loopback port: %v", err)
	}
	return address
}
