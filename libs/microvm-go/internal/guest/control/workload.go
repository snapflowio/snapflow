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
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/microvm-go/guest"
	guestconfig "github.com/snapflowio/microvm-go/guest/config"
	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/filewait"
)

const workloadInitMode = 0o600

func (s *Server) workloadReady(c *echo.Context) error {
	expectedGeneration := s.config.Snapshot().GenerationID
	startedGeneration, err := os.ReadFile(WorkloadStartedPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return writeProblem(c, http.StatusServiceUnavailable, "WORKLOAD_NOT_STARTED", "Workload has not started", true, nil)
		}
		return internalError(fmt.Errorf("inspect workload start receipt: %w", err))
	}
	if subtle.ConstantTimeCompare(startedGeneration, []byte(expectedGeneration)) != 1 {
		return writeProblem(c, http.StatusServiceUnavailable, "WORKLOAD_RECEIPT_STALE", "Workload start receipt is stale", false, nil)
	}
	return c.NoContent(http.StatusNoContent)
}

func (s *Server) ready(c *echo.Context) error {
	if s.config.Snapshot().DeferredWorkload {
		if _, err := os.Stat(WorkloadGatePath); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return writeProblem(c, http.StatusServiceUnavailable, "WORKLOAD_GATE_NOT_READY", "Workload initialization gate is not ready", true, nil)
			}
			return internalError(fmt.Errorf("inspect workload initialization gate: %w", err))
		}
	}
	return c.NoContent(http.StatusNoContent)
}

func (s *Server) initializeWorkload(ctx context.Context, request InitializeWorkloadRequest) error {
	if err := validateWorkloadInitialization(s.config.Snapshot(), request); err != nil {
		return err
	}
	data, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("encode workload initialization: %w", err)
	}
	digest := sha256.Sum256(data)
	s.workloadMu.Lock()
	defer s.workloadMu.Unlock()
	receipt, err := os.ReadFile(WorkloadAppliedPath)
	if err == nil {
		if subtle.ConstantTimeCompare(receipt, digest[:]) == 1 {
			return nil
		}
		return &guest.ControlProblem{Status: http.StatusConflict, Code: "WORKLOAD_INITIALIZATION_CONFLICT", Message: "Workload was initialized with a different request"}
	}
	if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("read workload initialization receipt: %w", err)
	}
	return publishWorkloadInitialization(ctx, data, digest[:])
}

func validateWorkloadInitialization(identity guestconfig.Config, request InitializeWorkloadRequest) error {
	if !identity.DeferredWorkload {
		return &guest.ControlProblem{Status: http.StatusConflict, Code: "WORKLOAD_INITIALIZATION_NOT_DEFERRED", Message: "Workload initialization is not deferred"}
	}
	if err := request.Validate(); err != nil {
		return &guest.ControlProblem{Status: http.StatusBadRequest, Code: "WORKLOAD_INITIALIZATION_INVALID", Message: "Workload initialization request is invalid"}
	}
	if request.InstanceID != identity.InstanceID || request.GenerationID != identity.GenerationID {
		return &guest.ControlProblem{Status: http.StatusConflict, Code: "WORKLOAD_IDENTITY_MISMATCH", Message: "Workload initialization identity does not match the guest"}
	}
	return nil
}

func publishWorkloadInitialization(ctx context.Context, data, digest []byte) error {
	if err := atomicfile.Replace(WorkloadInitPath, data, workloadInitMode); err != nil {
		return fmt.Errorf("write workload initialization: %w", err)
	}
	if err := atomicfile.Commit(WorkloadInitPath); err != nil {
		return fmt.Errorf("write workload initialization: %w", err)
	}
	if _, err := filewait.Read(ctx, WorkloadAppliedPath, func(applied []byte) error {
		if subtle.ConstantTimeCompare(applied, digest) != 1 {
			return errors.New("guest acknowledged a different workload initialization request")
		}
		return nil
	}); err != nil {
		removeErr := os.Remove(WorkloadInitPath)
		if errors.Is(removeErr, os.ErrNotExist) {
			removeErr = nil
		}
		return errors.Join(fmt.Errorf("wait for workload initialization acknowledgement: %w", err), removeErr)
	}
	return nil
}

func (s *Server) execHealth(c *echo.Context) error {
	request := ExecHealthRequest{}
	decoder := json.NewDecoder(http.MaxBytesReader(c.Response(), c.Request().Body, maxHealthRequestBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil || strings.TrimSpace(request.Command) == "" {
		return writeProblem(c, http.StatusBadRequest, "HEALTH_COMMAND_INVALID", "Health command is required", false, nil)
	}
	cmd := exec.CommandContext(c.Request().Context(), "/bin/sh", "-c", request.Command)
	if request.WorkingDir != "" {
		cmd.Dir = request.WorkingDir
	}
	output, runErr := cmd.CombinedOutput()
	if len(output) > 64*1024 {
		output = output[len(output)-64*1024:]
	}
	exitCode := 0
	if runErr != nil {
		var exitErr *exec.ExitError
		if errors.As(runErr, &exitErr) {
			exitCode = exitErr.ExitCode()
		} else {
			return internalError(runErr)
		}
	}
	return c.JSON(http.StatusOK, ExecHealthResponse{ExitCode: exitCode, Output: string(output)})
}

func (s *Server) telemetry(c *echo.Context) error {
	snapshot, err := collectTelemetry(c.Request().Context())
	if err != nil {
		return internalError(fmt.Errorf("collect instance telemetry: %w", err))
	}
	return c.JSON(http.StatusOK, snapshot)
}

func (s *Server) applySecrets(c *echo.Context) error {
	request := ApplySecretsRequest{}
	decoder := json.NewDecoder(http.MaxBytesReader(c.Response(), c.Request().Body, maxSecretEnvironmentPayloadBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		return writeProblem(c, http.StatusBadRequest, "SECRET_REQUEST_INVALID", "Secret environment request is invalid", false, nil)
	}
	if err := request.Validate(); err != nil {
		return writeProblem(c, http.StatusBadRequest, "SECRET_REQUEST_INVALID", "Secret environment request is invalid", false, nil)
	}
	data, err := json.Marshal(request.Values)
	if err != nil {
		return internalError(fmt.Errorf("encode secret environment: %w", err))
	}
	digest := sha256.Sum256(data)
	s.workloadMu.Lock()
	defer s.workloadMu.Unlock()

	if applied, err := os.ReadFile(s.secretPaths.applied); err == nil {
		if subtle.ConstantTimeCompare(applied, digest[:]) == 1 {
			return writeReceipt(c, "applied", request.Values)
		}
		return writeProblem(c, http.StatusConflict, "SECRET_ALREADY_CONSUMED", "A different secret environment was already consumed", false, nil)
	} else if !errors.Is(err, os.ErrNotExist) {
		return internalError(fmt.Errorf("inspect consumed secret environment: %w", err))
	}
	if _, err := os.Stat(s.secretPaths.started); err == nil {
		return writeProblem(c, http.StatusConflict, "WORKLOAD_ALREADY_STARTED", "Workload has already started", false, nil)
	} else if !errors.Is(err, os.ErrNotExist) {
		return internalError(fmt.Errorf("inspect workload start state: %w", err))
	}
	if pending, err := os.ReadFile(s.secretPaths.pending); err == nil {
		pendingDigest := sha256.Sum256(pending)
		if subtle.ConstantTimeCompare(pendingDigest[:], digest[:]) == 1 {
			return writeReceipt(c, "applied", request.Values)
		}
		return writeProblem(c, http.StatusConflict, "SECRET_PENDING_CONFLICT", "A different secret environment is already pending", false, nil)
	} else if !errors.Is(err, os.ErrNotExist) {
		return internalError(fmt.Errorf("inspect pending secret environment: %w", err))
	}
	if err := atomicfile.Replace(s.secretPaths.pending, data, filemode.PrivateFile); err != nil {
		return internalError(fmt.Errorf("write secret environment: %w", err))
	}
	if err := atomicfile.Commit(s.secretPaths.pending); err != nil {
		return internalError(fmt.Errorf("write secret environment: %w", err))
	}
	return writeReceipt(c, "applied", request.Values)
}
