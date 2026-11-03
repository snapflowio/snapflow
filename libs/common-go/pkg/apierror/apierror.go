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

package apierror

import (
	"context"
	"errors"
	"fmt"
	"net/http"
)

type Result interface {
	StatusCode() int
	GetBody() []byte
}

type Error struct {
	Operation  string
	StatusCode int
	Detail     string
	Cause      error
}

func (err *Error) Error() string {
	if err.StatusCode == 0 {
		return fmt.Sprintf("%s: %v", err.Operation, err.Cause)
	}
	if err.Detail == "" {
		return fmt.Sprintf("%s failed with HTTP %d: %v", err.Operation, err.StatusCode, err.Cause)
	}
	return fmt.Sprintf("%s failed with HTTP %d: %s", err.Operation, err.StatusCode, err.Detail)
}

func (err *Error) Unwrap() error { return err.Cause }

func (err *Error) Retryable() bool {
	if err.StatusCode == 0 {
		return !errors.Is(err.Cause, context.Canceled)
	}
	return RetryableStatus(err.StatusCode)
}

func (err *Error) Permanent() bool {
	return err.StatusCode >= http.StatusBadRequest &&
		err.StatusCode < http.StatusInternalServerError &&
		!RetryableStatus(err.StatusCode)
}

func RetryableStatus(statusCode int) bool {
	switch statusCode {
	case http.StatusRequestTimeout,
		http.StatusTooEarly,
		http.StatusTooManyRequests,
		http.StatusInternalServerError,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
		http.StatusGatewayTimeout:
		return true
	}
	return false
}

func CheckResponse(operation string, result Result, cause error) error {
	if cause != nil {
		return &Error{Operation: operation, Cause: cause}
	}
	statusCode := result.StatusCode()
	if statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices {
		return nil
	}
	return &Error{
		Operation:  operation,
		StatusCode: statusCode,
		Detail:     detail(result.GetBody()),
		Cause:      errors.New(http.StatusText(statusCode)),
	}
}

func Decode[R Result, T any](operation string, result R, cause error, payload func(R) *T) (*T, error) {
	if err := CheckResponse(operation, result, cause); err != nil {
		return nil, err
	}
	value := payload(result)
	if value == nil {
		return nil, fmt.Errorf("%s returned an empty response", operation)
	}
	return value, nil
}

func IsRetryable(err error) bool {
	var candidate *Error
	return errors.As(err, &candidate) && candidate.Retryable()
}

func IsPermanent(err error) bool {
	var candidate *Error
	return errors.As(err, &candidate) && candidate.Permanent()
}

func StatusOf(err error) (int, bool) {
	var candidate *Error
	if !errors.As(err, &candidate) || candidate.StatusCode == 0 {
		return 0, false
	}
	return candidate.StatusCode, true
}

func HasStatus(err error, statusCode int) bool {
	actual, found := StatusOf(err)
	return found && actual == statusCode
}
