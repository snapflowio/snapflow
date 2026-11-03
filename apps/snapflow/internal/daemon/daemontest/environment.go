// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package daemontest

import (
	"context"
	"log/slog"
	"net"
	"net/netip"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/daemon"
	"github.com/snapflowio/snapflow/internal/state"
)

const (
	Version               = "daemontest"
	tcpNetwork            = "tcp"
	loopbackHost          = "127.0.0.1"
	loopbackListenAddress = "127.0.0.1:0"
	readinessTimeout      = 30 * time.Second
	shutdownTimeout       = 45 * time.Second
	stateDirectoryName    = "state"
	dataDirectoryName     = "data"
	releaseDirectoryName  = "release"
	runtimeDirectoryName  = "runtime"
	ownerID               = "daemontest-owner"
)

type Environment struct {
	Daemon       *daemon.Daemon
	Config       *config.Config
	ControlPlane *ControlPlane
	Vault        *Vault
	APIAddress   string
	runResult    chan error
	shutdownOnce sync.Once
	shutdownErr  error
}

func Start(t *testing.T) *Environment {
	t.Helper()
	machineID := uuid.New()
	controlPlane := newControlPlane(t, machineID)
	t.Cleanup(controlPlane.close)
	cfg := environmentConfig(t)
	vault := newVault()
	register(t, cfg.Machine.StateDirectory, vault, machineID, controlPlane.APIURL())
	machine, err := daemon.New(
		cfg,
		daemon.WithLogger(slog.New(slog.NewTextHandler(t.Output(), nil))),
		daemon.WithVersion(Version),
		daemon.WithReleaseLoader(loadRelease),
		daemon.WithPreflight(preflight),
		daemon.WithVault(vault.open),
		daemon.WithHostProbe(probeHost),
		daemon.WithRuntime(openEngine),
	)
	if err != nil {
		t.Fatalf("create snapflowd: %v", err)
	}
	environment := &Environment{
		Daemon: machine, Config: cfg, ControlPlane: controlPlane, Vault: vault,
		APIAddress: net.JoinHostPort(loopbackHost, strconv.Itoa(cfg.API.Port)),
		runResult:  make(chan error, 1),
	}
	go func() { environment.runResult <- machine.Run(context.Background()) }()
	t.Cleanup(func() {
		if err := environment.Shutdown(); err != nil {
			t.Errorf("snapflowd stopped with an error: %v", err)
		}
	})
	environment.awaitReady(t)
	return environment
}

func (environment *Environment) Shutdown() error {
	environment.shutdownOnce.Do(func() {
		ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := environment.Daemon.Shutdown(ctx); err != nil {
			environment.shutdownErr = err
			return
		}
		environment.shutdownErr = <-environment.runResult
	})
	return environment.shutdownErr
}

func (environment *Environment) awaitReady(t *testing.T) {
	t.Helper()
	timer := time.NewTimer(readinessTimeout)
	defer timer.Stop()
	select {
	case <-environment.ControlPlane.ready:
	case err := <-environment.runResult:
		environment.runResult <- err
		t.Fatalf("snapflowd stopped before it published readiness: %v (unhandled requests %v)",
			err, environment.ControlPlane.Unhandled())
	case <-timer.C:
		t.Fatalf("snapflowd did not publish readiness within %s (unhandled requests %v)",
			readinessTimeout, environment.ControlPlane.Unhandled())
	}
}

func environmentConfig(t *testing.T) *config.Config {
	t.Helper()
	cfg, err := config.Load(config.Development)
	if err != nil {
		t.Fatalf("load development configuration: %v", err)
	}
	root := t.TempDir()
	cfg.Machine.StateDirectory = filepath.Join(root, stateDirectoryName)
	cfg.Runtime.DataDirectory = filepath.Join(root, dataDirectoryName)
	cfg.Runtime.ReleaseRoot = filepath.Join(root, releaseDirectoryName)
	cfg.Runtime.ManagementRuntimeRoot = filepath.Join(root, runtimeDirectoryName)
	cfg.SSH.Enabled = false
	cfg.API.Port = freePort(t)
	return cfg
}

func register(t *testing.T, stateDirectory string, vault *Vault, machineID uuid.UUID, apiURL string) {
	t.Helper()
	database, err := state.OpenDatabase(t.Context(), stateDirectory)
	if err != nil {
		t.Fatalf("open machine state: %v", err)
	}
	defer func() {
		if err := database.Close(t.Context()); err != nil {
			t.Errorf("close machine state: %v", err)
		}
	}()
	store, err := state.NewStore(state.StoreConfig{Database: database, Vault: vault})
	if err != nil {
		t.Fatalf("create identity store: %v", err)
	}
	publicKey, signingKey, err := state.GenerateSigningKey()
	if err != nil {
		t.Fatalf("generate machine signing key: %v", err)
	}
	keyID, err := state.KeyID(publicKey)
	if err != nil {
		t.Fatalf("derive machine key ID: %v", err)
	}
	identity := &state.Identity{APIURL: apiURL, MachineID: machineID.String(), OwnerID: ownerID, KeyID: keyID, SigningKey: signingKey}
	if err := store.Save(t.Context(), identity); err != nil {
		t.Fatalf("register machine identity: %v", err)
	}
}

func freePort(t *testing.T) int {
	t.Helper()
	var listenerConfig net.ListenConfig
	listener, err := listenerConfig.Listen(t.Context(), tcpNetwork, loopbackListenAddress)
	if err != nil {
		t.Fatalf("reserve a loopback port: %v", err)
	}
	address, err := netip.ParseAddrPort(listener.Addr().String())
	if err != nil {
		t.Fatalf("parse the reserved loopback address: %v", err)
	}
	if err := listener.Close(); err != nil {
		t.Fatalf("release a loopback port: %v", err)
	}
	return int(address.Port())
}
