// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at https://www.apache.org/licenses/LICENSE-2.0
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
	"log/slog"
	"net/http"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
)

const (
	maxStackTraceSize       = 64 * 1024
	unknownStatusCodeName   = "HTTP_ERROR"
	statusCodeNameSeparator = "_"
)

type DefaultErrorHandler func(ctx *echo.Context, err error) ErrorResponse

func NewHTTPErrorHandler(defaultErrorHandler DefaultErrorHandler) echo.HTTPErrorHandler {
	return func(ctx *echo.Context, err error) {
		response, unwrapErr := echo.UnwrapResponse(ctx.Response())
		if unwrapErr == nil && response.Committed {
			return
		}

		errorResponse := toErrorResponse(ctx, err, defaultErrorHandler)
		logHTTPError(ctx, errorResponse)

		if writeErr := ctx.JSON(errorResponse.StatusCode, errorResponse); writeErr != nil {
			slog.Error("failed to write API error response", "error", writeErr)
		}
	}
}

func toErrorResponse(ctx *echo.Context, err error, defaultErrorHandler DefaultErrorHandler) ErrorResponse {
	request := ctx.Request()
	response := ErrorResponse{
		Timestamp: time.Now(),
		Path:      request.URL.Path,
		Method:    request.Method,
	}
	var httpErr *HTTPError
	var echoErr *echo.HTTPError
	switch {
	case errors.As(err, &httpErr):
		response.StatusCode = httpErr.StatusCode
		response.Message = httpErr.Message
		response.Code = httpErr.Code
	case errors.As(err, &echoErr):
		response.StatusCode = echoErr.Code
		response.Message = echoErr.Message
		response.Code = statusCodeName(echoErr.Code)
	case echo.StatusCode(err) != 0:
		response.StatusCode = echo.StatusCode(err)
		response.Message = err.Error()
		response.Code = statusCodeName(response.StatusCode)
	default:
		return defaultErrorHandler(ctx, err)
	}
	return response
}

func statusCodeName(statusCode int) string {
	name := http.StatusText(statusCode)
	if name == "" {
		return unknownStatusCodeName
	}
	return strings.ToUpper(regexp.MustCompile(`[^A-Za-z0-9]+`).ReplaceAllString(name, statusCodeNameSeparator))
}

func logHTTPError(ctx *echo.Context, response ErrorResponse) {
	request := ctx.Request()
	if response.StatusCode == http.StatusInternalServerError {
		slog.Error(
			"Internal Server Error",
			"path", request.URL.Path,
			"method", request.Method,
			"error", response.Message,
		)
		return
	}

	slog.Error(
		"API ERROR",
		"method", request.Method,
		"URI", request.URL.Path,
		"status", response.StatusCode,
		"error", response.Message,
	)
}

func Recovery() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(ctx *echo.Context) (handlerErr error) {
			defer func() {
				recovered := recover()
				if recovered == nil {
					return
				}

				if recoveredError, ok := recovered.(error); ok && errors.Is(recoveredError, http.ErrAbortHandler) {
					handlerErr = nil
					return
				}

				buffer := make([]byte, maxStackTraceSize)
				stackSize := runtime.Stack(buffer, false)
				slog.Error("panic recovered", "panic", recovered, "stack", string(buffer[:stackSize]))
				handlerErr = NewInternalServerError(errors.New("internal server error"))
			}()

			return next(ctx)
		}
	}
}
