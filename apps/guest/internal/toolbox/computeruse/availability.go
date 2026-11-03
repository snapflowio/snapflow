// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package computeruse

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
)

type Availability string

const (
	AvailabilityLoading     Availability = "loading"
	AvailabilityReady       Availability = "ready"
	AvailabilityUnavailable Availability = "unavailable"
	AvailabilityFailed      Availability = "error"
)

const pluginLoadWaitTimeout = 30 * time.Second

const (
	CodeComputerUseLoading     = "COMPUTER_USE_LOADING"
	CodeComputerUseUnavailable = "COMPUTER_USE_UNAVAILABLE"
	CodeComputerUseFailed      = "COMPUTER_USE_FAILED"
)

var (
	ErrUnavailable = errors.New("computer use is not available because the sandbox was created without the desktop capability")
	errNotLoaded   = errors.New("computer-use plugin is not loaded yet")
	errLoadFailed  = errors.New("computer-use plugin failed to initialize")
)

type UnavailableResponse struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Solution string `json:"solution"`
}

type unavailableReply struct {
	status   int
	code     string
	solution string
}

func unavailableReplies() map[Availability]unavailableReply {
	return map[Availability]unavailableReply{
		AvailabilityLoading: {
			status: http.StatusServiceUnavailable, code: CodeComputerUseLoading,
			solution: "Retry shortly.",
		},
		AvailabilityUnavailable: {
			status: http.StatusConflict, code: CodeComputerUseUnavailable,
			solution: "Create the sandbox with the desktop capability to use computer use.",
		},
		AvailabilityFailed: {
			status: http.StatusServiceUnavailable, code: CodeComputerUseFailed,
			solution: "Recreate the sandbox. If the cause in the message persists, republish the machine's desktop-extension release.",
		},
	}
}

func AvailabilityMiddleware(lazy *LazyComputerUse) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			waitContext, cancel := context.WithTimeout(c.Request().Context(), pluginLoadWaitTimeout)
			defer cancel()
			lazy.waitSettled(waitContext)
			availability, err := lazy.state()
			reply, unavailable := unavailableReplies()[availability]
			if !unavailable {
				return next(c)
			}
			return c.JSON(reply.status, UnavailableResponse{
				Code: reply.code, Message: err.Error(), Solution: reply.solution,
			})
		}
	}
}
