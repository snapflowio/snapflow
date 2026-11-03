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
	"crypto/ed25519"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	"github.com/snapflowio/microvm-go/guest"
	guestconfig "github.com/snapflowio/microvm-go/guest/config"
)

type Server struct {
	sessions         SessionResetter
	config           *guestconfig.Store
	secretPaths      secretEnvironmentPaths
	workloadMu       sync.Mutex
	quiesceMu        sync.Mutex
	filesystem       filesystemQuiescer
	filesystemFrozen bool
	volumeQuiescer   func(path string) filesystemQuiescer
	volumes          volumeFreeze
	sessionMu        sync.Mutex
	guestSessions    map[string]guestSession
	guestPublicKey   ed25519.PublicKey
	guestPrivateKey  ed25519.PrivateKey
	buildDigest      string
	credentialRoot   string
}

type ServerOption func(*Server) error

func withFilesystemQuiescer(quiescer filesystemQuiescer) ServerOption {
	return func(server *Server) error {
		if quiescer == nil {
			return errors.New("filesystem quiescer is required")
		}
		server.filesystem = quiescer
		return nil
	}
}

func withVolumeQuiescer(factory func(path string) filesystemQuiescer) ServerOption {
	return func(server *Server) error {
		if factory == nil {
			return errors.New("volume quiescer factory is required")
		}
		server.volumeQuiescer = factory
		return nil
	}
}

type secretEnvironmentPaths struct {
	pending string
	applied string
	started string
}

func defaultSecretEnvironmentPaths() secretEnvironmentPaths {
	return secretEnvironmentPaths{
		pending: WorkloadSecretsPath,
		applied: WorkloadSecretsAppliedPath,
		started: WorkloadStartedPath,
	}
}

func NewServer(sessions SessionResetter, config *guestconfig.Store, options ...ServerOption) (*Server, error) {
	if sessions == nil {
		return nil, fmt.Errorf("session resetter is required")
	}
	if config == nil {
		return nil, fmt.Errorf("guest init config store is required")
	}
	publicKey, privateKey, err := newGuestEphemeralKey()
	if err != nil {
		return nil, err
	}
	buildDigest, err := executableDigest()
	if err != nil {
		return nil, err
	}
	server := &Server{
		buildDigest:     buildDigest,
		sessions:        sessions,
		config:          config,
		secretPaths:     defaultSecretEnvironmentPaths(),
		filesystem:      noOpFilesystemQuiescer{},
		volumeQuiescer:  newVolumeFilesystemQuiescer,
		guestSessions:   make(map[string]guestSession),
		guestPublicKey:  publicKey,
		guestPrivateKey: privateKey,
		credentialRoot:  guest.ServiceCredentialRoot,
	}
	for index, option := range options {
		if option == nil {
			return nil, fmt.Errorf("control server option %d is nil", index)
		}
		if err := option(server); err != nil {
			return nil, fmt.Errorf("apply control server option %d: %w", index, err)
		}
	}
	return server, nil
}

func (s *Server) Handler() http.Handler {
	e := echo.NewWithConfig(echo.Config{HTTPErrorHandler: typedHTTPErrorHandler})
	e.Use(middleware.Recover())
	e.Use(boundedControlRequests())
	e.Use(s.authenticate)
	e.Use(s.requireSession)
	e.POST(SessionPath, s.createSession)
	e.GET(ReadyPath, s.ready)
	e.GET(WorkloadReadyPath, s.workloadReady)
	e.POST(RestorePath, s.restore)
	e.POST(ForkPreparePath, s.prepareFork)
	e.POST(ForkResumePath, s.resumeFork)
	e.POST(SecretsApplyPath, s.applySecrets)
	e.POST(HostsApplyPath, s.applyHosts)
	e.POST(VolumesFreezePath, s.freezeVolumes)
	e.POST(VolumesThawPath, s.thawVolumes)
	e.POST(HealthExecPath, s.execHealth)
	e.GET(TelemetryPath, s.telemetry)
	return e
}

func typedHTTPErrorHandler(c *echo.Context, err error) {
	response, unwrapErr := echo.UnwrapResponse(c.Response())
	if unwrapErr == nil && response.Committed {
		return
	}
	status := http.StatusInternalServerError
	code := "GUEST_CONTROL_INTERNAL"
	message := "Guest control request failed"
	if httpStatus := echo.StatusCode(err); httpStatus >= 400 && httpStatus < 500 {
		status = httpStatus
		code = "GUEST_CONTROL_REQUEST_REJECTED"
		message = http.StatusText(status)
	} else {
		slog.ErrorContext(c.Request().Context(), "guest control request failed", "error", err)
	}
	if writeErr := writeProblem(
		c,
		status,
		code,
		message,
		false,
		nil,
	); writeErr != nil {
		slog.ErrorContext(c.Request().Context(), "write guest control problem response", "error", writeErr)
	}
}

func (s *Server) authenticate(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		expected := s.config.Snapshot().ControlAuthToken
		actual := c.Request().Header.Get(ControlTokenHeader)
		if len(expected) == 0 || len(actual) != len(expected) || subtle.ConstantTimeCompare([]byte(actual), []byte(expected)) != 1 {
			return writeProblem(c, http.StatusUnauthorized, "CONTROL_CREDENTIAL_INVALID", "Instance control credential is invalid", false, nil)
		}
		return next(c)
	}
}

func internalError(err error) error {
	return echo.NewHTTPError(http.StatusInternalServerError, err.Error()).Wrap(err)
}
