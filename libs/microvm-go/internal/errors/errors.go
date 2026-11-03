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

package errors

import (
	"fmt"
	"net/http"
)

type Error struct {
	StatusCode int
	Message    string
	Code       string
	cause      error
}

func (e *Error) Error() string { return e.Message }

func New(statusCode int, message, code string) error {
	return &Error{StatusCode: statusCode, Message: message, Code: code}
}

func NewWithCause(statusCode int, message, code string, cause error) error {
	return &Error{StatusCode: statusCode, Message: message, Code: code, cause: cause}
}

func (e *Error) HTTPStatusCode() int { return e.StatusCode }

func (e *Error) ErrorCode() string { return e.Code }

func (e *Error) Unwrap() error { return e.cause }

type NotFoundError struct {
	Message string
	cause   error
}

func (e *NotFoundError) Error() string { return e.Message }

func NewNotFound(err error) error {
	return &NotFoundError{
		Message: fmt.Sprintf("not found: %s", err.Error()),
		cause:   err,
	}
}

func (e *NotFoundError) HTTPStatusCode() int { return http.StatusNotFound }

func (e *NotFoundError) ErrorCode() string { return "NOT_FOUND" }

func (e *NotFoundError) Unwrap() error { return e.cause }

type InvalidRequestError struct {
	Message string
	cause   error
}

func (e *InvalidRequestError) Error() string { return e.Message }

func NewInvalidRequest(err error) error {
	return &InvalidRequestError{
		Message: fmt.Sprintf("invalid body request: %s", err.Error()),
		cause:   err,
	}
}

func (e *InvalidRequestError) HTTPStatusCode() int { return http.StatusBadRequest }

func (e *InvalidRequestError) ErrorCode() string { return "INVALID_REQUEST_BODY" }

func (e *InvalidRequestError) Unwrap() error { return e.cause }
