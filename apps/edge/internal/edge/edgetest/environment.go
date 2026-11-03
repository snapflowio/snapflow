// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package edgetest

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/deployment"
	"github.com/snapflowio/edge/internal/control"
	"github.com/snapflowio/edge/internal/edge"
	httpproxy "github.com/snapflowio/edge/internal/proxy/http"
	"github.com/snapflowio/edge/internal/telemetry"
	"github.com/snapflowio/edge/internal/tunnel"
)

const (
	loopbackListenAddress = "127.0.0.1:0"
	readinessPath         = "/readyz"
	readinessTimeout      = 15 * time.Second
	readinessPollInterval = 20 * time.Millisecond
	shutdownTimeout       = 45 * time.Second
	testVersion           = "edgetest"
)

type Environment struct {
	Server         *edge.Server
	Config         edge.Config
	ControlPlane   *ControlPlane
	Tunnels        *Tunnels
	HTTPAddress    string
	HTTPSAddress   string
	MetricsAddress string
	runResult      chan error
	shutdownOnce   sync.Once
	shutdownErr    error
}

type staticHostSampler struct{}

func (staticHostSampler) Sample() (telemetry.HostSample, error) {
	return telemetry.HostSample{}, nil
}

func Start(t *testing.T, routeSpecs ...Route) *Environment {
	t.Helper()
	edgeID := uuid.New()
	controlPlane := newControlPlane(edgeID, routeSpecs)
	t.Cleanup(controlPlane.close)
	hosts := make([]string, 0, len(routeSpecs))
	for _, route := range routeSpecs {
		hosts = append(hosts, route.Host)
	}
	return launch(t, controlPlane, edge.Config{
		Profile:  deployment.Development,
		LogLevel: slog.LevelDebug,
		EdgeID:   edgeID.String(),
		StateDir: t.TempDir(),
		Control:  control.Config{APIURL: controlPlane.APIURL()},
		TLS:      writeCertificates(t, t.TempDir(), hosts),
	})
}

func (environment *Environment) Restart(t *testing.T, stateDir string) *Environment {
	t.Helper()
	if err := environment.Shutdown(); err != nil {
		t.Fatalf("stop the edge server before restarting it: %v", err)
	}
	config := environment.Config
	config.StateDir = stateDir
	return launch(t, environment.ControlPlane, config)
}

func launch(t *testing.T, controlPlane *ControlPlane, config edge.Config) *Environment {
	t.Helper()
	config.Tunnel = tunnel.Config{ListenAddress: freeAddress(t)}
	config.HTTP = httpproxy.Config{
		HTTPAddress:  freeAddress(t),
		HTTPSAddress: freeAddress(t),
	}
	config.Telemetry = telemetry.Config{ListenAddress: freeAddress(t)}
	tunnels := newTunnels(controlPlane.routes)
	server, err := edge.New(
		config,
		edge.WithLogger(slog.New(slog.DiscardHandler)),
		edge.WithVersion(testVersion),
		edge.WithTunnels(tunnels),
		edge.WithHostSampler(staticHostSampler{}),
	)
	if err != nil {
		t.Fatalf("create edge server: %v", err)
	}
	environment := &Environment{
		Server:         server,
		Config:         config,
		ControlPlane:   controlPlane,
		Tunnels:        tunnels,
		HTTPAddress:    config.HTTP.HTTPAddress,
		HTTPSAddress:   config.HTTP.HTTPSAddress,
		MetricsAddress: config.Telemetry.ListenAddress,
		runResult:      make(chan error, 1),
	}
	go func() { environment.runResult <- server.Run(context.Background()) }()
	t.Cleanup(func() {
		if err := environment.Shutdown(); err != nil {
			t.Errorf("edge server stopped with an error: %v", err)
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
	client := &http.Client{Timeout: readinessPollInterval * 10}
	deadline := time.Now().Add(readinessTimeout)
	readinessURL := "http://" + environment.MetricsAddress + readinessPath
	for time.Now().Before(deadline) {
		select {
		case err := <-environment.runResult:
			environment.runResult <- err
			t.Fatalf("edge server stopped before it became ready: %v", err)
		default:
		}
		request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, readinessURL, http.NoBody)
		if err != nil {
			t.Fatalf("create readiness request: %v", err)
		}
		response, err := client.Do(request)
		if err == nil {
			ready := response.StatusCode == http.StatusNoContent
			if closeErr := response.Body.Close(); closeErr != nil {
				t.Fatalf("close readiness response: %v", closeErr)
			}
			if ready {
				return
			}
		}
		time.Sleep(readinessPollInterval)
	}
	t.Fatalf("edge server did not become ready within %s", readinessTimeout)
}

func freeAddress(t *testing.T) string {
	t.Helper()
	var listenerConfig net.ListenConfig
	listener, err := listenerConfig.Listen(t.Context(), tcpNetwork, loopbackListenAddress)
	if err != nil {
		t.Fatalf("reserve a loopback port: %v", err)
	}
	address := listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("release a loopback port: %v", err)
	}
	return address
}
