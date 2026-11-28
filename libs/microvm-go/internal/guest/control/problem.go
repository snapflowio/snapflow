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
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/microvm-go/guest"
)

const guestControlRetryAfterSeconds = 1

func decodeBoundedJSON(c *echo.Context, destination any, maximumBytes int64) error {
	decoder := json.NewDecoder(http.MaxBytesReader(c.Response(), c.Request().Body, maximumBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("decode request: %w", err)
	}
	return nil
}

func writeProblem(c *echo.Context, status int, code, message string, retryable bool, details *guest.ControlProblemDetails) error {
	return c.JSON(status, Problem{Code: code, Message: message, Retryable: retryable, Details: details})
}

func writeControlError(c *echo.Context, err error, step *string) error {
	var problem *guest.ControlProblem
	if errors.As(err, &problem) {
		details := problem.Details
		if step != nil {
			details = &guest.ControlProblemDetails{Step: *step}
			if problem.Details != nil {
				details.RetryAfterSeconds = problem.Details.RetryAfterSeconds
			}
		}
		return writeProblem(c, problem.Status, problem.Code, problem.Message, problem.Retryable, details)
	}
	if step == nil {
		return internalError(err)
	}
	return writeProblem(c, http.StatusInternalServerError, "GUEST_RESTORE_STEP_FAILED", err.Error(), false, &guest.ControlProblemDetails{Step: *step})
}

func retryAfterDetails() *guest.ControlProblemDetails {
	return &guest.ControlProblemDetails{RetryAfterSeconds: guestControlRetryAfterSeconds}
}

func writeReceipt(c *echo.Context, state string, request any) error {
	data, err := json.Marshal(request)
	if err != nil {
		return internalError(fmt.Errorf("encode mutation receipt: %w", err))
	}
	digest := sha256.Sum256(data)
	return c.JSON(http.StatusOK, Response{
		Status:                state,
		AcceptedRequestDigest: "sha256:" + hex.EncodeToString(digest[:]),
	})
}
