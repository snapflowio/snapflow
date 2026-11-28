// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type runtimeHTTPError interface {
	error
	HTTPStatusCode() int
	ErrorCode() string
}

const runtimeNotFoundCode = "NOT_FOUND"

func recoverableStorageErrorPatterns() []string {
	return []string{
		"no space left on device",
		"storage limit",
		"disk quota exceeded",
	}
}

type recoverableError struct {
	ErrorReason string `json:"errorReason"`
	Recoverable bool   `json:"recoverable"`
}

type recoverableFailure struct {
	cause   error
	payload string
}

func (failure *recoverableFailure) Error() string { return failure.payload }

func (failure *recoverableFailure) Unwrap() error { return failure.cause }

func IsRuntimeNotFound(err error) bool {
	var runtimeErr runtimeHTTPError
	return errors.As(err, &runtimeErr) &&
		runtimeErr.HTTPStatusCode() == http.StatusNotFound &&
		runtimeErr.ErrorCode() == runtimeNotFoundCode
}

func IsRecoverable(reason string) bool {
	reason = strings.ToLower(strings.TrimSpace(reason))
	for _, pattern := range recoverableStorageErrorPatterns() {
		if strings.Contains(reason, pattern) {
			return true
		}
	}
	return false
}

func FormatRecoverableError(err error) error {
	if err == nil || !IsRecoverable(err.Error()) {
		return err
	}
	payload, marshalErr := json.Marshal(recoverableError{
		ErrorReason: err.Error(),
		Recoverable: true,
	})
	if marshalErr != nil {
		return errors.Join(err, marshalErr)
	}
	return &recoverableFailure{cause: err, payload: string(payload)}
}
