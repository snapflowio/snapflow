// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package lifecycle

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/guest/internal/serve"
)

const (
	maxWorkloadBytes    = 1 << 20
	socketDirectoryMode = 0o700
	socketMode          = 0o600
	socketNetwork       = "unix"
)

type Server struct {
	logger     *slog.Logger
	socketPath string
	mu         sync.Mutex
	applied    map[string]struct{}
}

func New(logger *slog.Logger, socketPath string) *Server {
	return &Server{
		logger:     logger.With(slog.String("component", "lifecycle")),
		socketPath: socketPath,
		applied:    make(map[string]struct{}),
	}
}

func (s *Server) Run(ctx context.Context) error {
	listener, err := s.listen(ctx)
	if err != nil {
		return err
	}
	return s.serve(ctx, listener)
}

func (s *Server) serve(ctx context.Context, listener net.Listener) error {
	mux := http.NewServeMux()
	mux.HandleFunc("POST "+guestspec.LifecycleWorkloadPath, s.applyWorkload)
	if err := serve.HTTP(ctx, &http.Server{Handler: mux}, listener); err != nil {
		return fmt.Errorf("serve lifecycle socket: %w", err)
	}
	return nil
}

func (s *Server) listen(ctx context.Context) (net.Listener, error) {
	if err := os.MkdirAll(filepath.Dir(s.socketPath), socketDirectoryMode); err != nil {
		return nil, fmt.Errorf("create lifecycle socket directory: %w", err)
	}
	if err := removeStaleSocket(s.socketPath); err != nil {
		return nil, err
	}
	listener, err := new(net.ListenConfig).Listen(ctx, socketNetwork, s.socketPath)
	if err != nil {
		return nil, fmt.Errorf("listen on lifecycle socket: %w", err)
	}
	if err := os.Chmod(s.socketPath, socketMode); err != nil {
		return nil, errors.Join(fmt.Errorf("restrict lifecycle socket: %w", err), listener.Close())
	}
	return listener, nil
}

func (s *Server) applyWorkload(writer http.ResponseWriter, request *http.Request) {
	var workload guestspec.Workload
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maxWorkloadBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&workload); err != nil {
		http.Error(writer, "workload request is invalid", http.StatusBadRequest)
		return
	}
	if err := validateEnvironment(workload.Env); err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.apply(workload.Env); err != nil {
		s.logger.Error("Failed to apply workload environment", "error", err)
		http.Error(writer, "workload environment could not be applied", http.StatusInternalServerError)
		return
	}
	s.logger.Debug("Applied workload environment", "variables", len(workload.Env))
	writer.WriteHeader(http.StatusNoContent)
}

func (s *Server) apply(env map[string]string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for name := range s.applied {
		if _, kept := env[name]; kept {
			continue
		}
		if err := os.Unsetenv(name); err != nil {
			return fmt.Errorf("unset %s: %w", name, err)
		}
		delete(s.applied, name)
	}
	for name, value := range env {
		if err := os.Setenv(name, value); err != nil {
			return fmt.Errorf("set %s: %w", name, err)
		}
		s.applied[name] = struct{}{}
	}
	return nil
}

func validateEnvironment(env map[string]string) error {
	for name, value := range env {
		if strings.TrimSpace(name) == "" || strings.ContainsAny(name, "=\x00") {
			return fmt.Errorf("environment variable name %q is invalid", name)
		}
		if strings.ContainsRune(value, 0) {
			return fmt.Errorf("environment variable %q contains a NUL byte", name)
		}
	}
	return nil
}

func removeStaleSocket(socketPath string) error {
	info, err := os.Lstat(socketPath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("inspect lifecycle socket: %w", err)
	}
	if info.Mode()&fs.ModeSocket == 0 {
		return fmt.Errorf("lifecycle socket path %s is not a socket", socketPath)
	}
	if err := os.Remove(socketPath); err != nil {
		return fmt.Errorf("remove stale lifecycle socket: %w", err)
	}
	return nil
}
