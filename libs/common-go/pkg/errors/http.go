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
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"time"
)

// @Description	Error response
// @Schema			ErrorResponse
type ErrorResponse struct {
	StatusCode int       `json:"statusCode" example:"400" binding:"required"`
	Message    string    `json:"message" example:"Bad request" binding:"required"`
	Code       string    `json:"code,omitempty" example:"BAD_REQUEST"`
	Timestamp  time.Time `json:"timestamp" example:"2023-01-01T12:00:00Z" binding:"required"`
	Path       string    `json:"path" example:"/api/resource" binding:"required"`
	Method     string    `json:"method,omitempty" example:"GET"`
} //	@name	ErrorResponse

const (
	codeNotFound            = "NOT_FOUND"
	codeUnauthorized        = "UNAUTHORIZED"
	codeInvalidRequestBody  = "INVALID_REQUEST_BODY"
	codeConflict            = "CONFLICT"
	codeBadRequest          = "BAD_REQUEST"
	codeForbidden           = "FORBIDDEN"
	codeRequestTimeout      = "REQUEST_TIMEOUT"
	codeGone                = "GONE"
	codeInternalServerError = "INTERNAL_SERVER_ERROR"
	userLookupMatchGroups   = 2
)

type HTTPError struct {
	StatusCode int
	Message    string
	Code       string
}

func (e *HTTPError) Error() string {
	return e.Message
}

func NewCustomError(statusCode int, message, code string) error {
	return &HTTPError{StatusCode: statusCode, Message: message, Code: code}
}

func NewNotFoundError(err error) error {
	return newHTTPError(http.StatusNotFound, codeNotFound, "not found", err)
}

func NewInvalidBodyRequestError(err error) error {
	return newHTTPError(http.StatusBadRequest, codeInvalidRequestBody, "invalid body request", err)
}

func NewUnauthorizedError(err error) error {
	return newHTTPError(http.StatusUnauthorized, codeUnauthorized, "unauthorized", err)
}

func NewConflictError(err error) error {
	return newHTTPError(http.StatusConflict, codeConflict, "conflict", err)
}

func NewBadRequestError(err error) error {
	badRequest := newHTTPError(http.StatusBadRequest, codeBadRequest, "bad request", err)
	badRequest.Message = userLookupMessage(badRequest.Message)
	return badRequest
}

func NewForbiddenError(err error) error {
	return newHTTPError(http.StatusForbidden, codeForbidden, "forbidden", err)
}

func NewRequestTimeoutError(err error) error {
	return newHTTPError(http.StatusRequestTimeout, codeRequestTimeout, "request timeout", err)
}

func NewGoneError(err error) error {
	return newHTTPError(http.StatusGone, codeGone, "gone", err)
}

func NewInternalServerError(err error) error {
	return newHTTPError(http.StatusInternalServerError, codeInternalServerError, "internal server error", err)
}

func IsNotFoundError(err error) bool {
	return hasStatus(err, http.StatusNotFound)
}

func IsRequestTimeoutError(err error) bool {
	return hasStatus(err, http.StatusRequestTimeout)
}

func newHTTPError(statusCode int, code, prefix string, err error) *HTTPError {
	return &HTTPError{
		StatusCode: statusCode,
		Message:    fmt.Sprintf("%s: %s", prefix, err.Error()),
		Code:       code,
	}
}

func hasStatus(err error, statusCode int) bool {
	var httpErr *HTTPError
	return errors.As(err, &httpErr) && httpErr.StatusCode == statusCode
}

func userLookupMessage(message string) string {
	matches := regexp.MustCompile(`(unable to find user [^:]+)`).FindStringSubmatch(message)
	if len(matches) < userLookupMatchGroups {
		return message
	}
	return fmt.Sprintf("bad request: %s", matches[1])
}
