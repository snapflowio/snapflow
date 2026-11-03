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
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/microvm-go/guest"
)

const maxRestoreRequestBytes = maxSecretEnvironmentPayloadBytes*2 + 1<<20

func (s *Server) restore(c *echo.Context) error {
	var request RestoreRequest
	if err := decodeBoundedJSON(c, &request, maxRestoreRequestBytes); err != nil {
		return writeProblem(c, http.StatusBadRequest, "RESTORE_REQUEST_INVALID", "Restore request is invalid", false, &guest.ControlProblemDetails{Step: RestoreStepRequest})
	}
	if err := request.Validate(); err != nil {
		return writeProblem(c, http.StatusBadRequest, "RESTORE_REQUEST_INVALID", err.Error(), false, &guest.ControlProblemDetails{Step: RestoreStepRequest})
	}
	ctx := c.Request().Context()
	step := RestoreStepIdentity
	if err := s.applyRestoredIdentity(ctx, request.Identity); err != nil {
		return writeControlError(c, err, &step)
	}
	step = RestoreStepResume
	if err := s.resumeComponents(ctx); err != nil {
		return writeControlError(c, err, &step)
	}
	if request.Workload != nil {
		step = RestoreStepWorkload
		if err := s.initializeWorkload(ctx, *request.Workload); err != nil {
			return writeControlError(c, err, &step)
		}
	}
	step = RestoreStepSession
	session, err := s.issueSession(request.Session)
	if err != nil {
		return writeControlError(c, err, &step)
	}
	return c.JSON(http.StatusOK, RestoreResponse{Session: session})
}

func (r RestoreRequest) Validate() error {
	if err := r.Identity.Validate(); err != nil {
		return fmt.Errorf("restored identity: %w", err)
	}
	if err := validateSessionRequest(r.Session); err != nil {
		return fmt.Errorf("restored session: %w", err)
	}
	if r.Workload == nil {
		return nil
	}
	if err := r.Workload.Validate(); err != nil {
		return fmt.Errorf("restored workload: %w", err)
	}
	if r.Workload.InstanceID != r.Identity.InstanceID || r.Workload.GenerationID != r.Identity.GenerationID {
		return fmt.Errorf("restored workload identity does not match the restored guest identity")
	}
	return nil
}
