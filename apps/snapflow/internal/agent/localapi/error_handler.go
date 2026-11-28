// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package localapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	commonerrors "github.com/snapflowio/common-go/pkg/errors"
)

type runtimeHTTPError interface {
	error
	HTTPStatusCode() int
	ErrorCode() string
}

func handleRuntimeError(ctx *echo.Context, err error) commonerrors.ErrorResponse {
	request := ctx.Request()
	status, code := http.StatusInternalServerError, "INTERNAL_SERVER_ERROR"
	var runtimeErr runtimeHTTPError
	if errors.As(err, &runtimeErr) {
		status, code = runtimeErr.HTTPStatusCode(), runtimeErr.ErrorCode()
	} else if errors.Is(err, context.Canceled) {
		status, code = http.StatusRequestTimeout, "REQUEST_CANCELED"
	} else if errors.Is(err, context.DeadlineExceeded) {
		status, code = http.StatusGatewayTimeout, "DEADLINE_EXCEEDED"
	}

	return commonerrors.ErrorResponse{
		StatusCode: status,
		Message:    err.Error(),
		Code:       code,
		Timestamp:  time.Now(),
		Path:       request.URL.Path,
		Method:     request.Method,
	}
}
