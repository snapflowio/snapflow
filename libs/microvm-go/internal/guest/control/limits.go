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
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
)

const (
	maximumConcurrentControlRequests = 32
	controlHandlerDeadline           = 30 * time.Second
	maxHostsRequestBytes             = 16 * 1024
	maxSessionRequestBytes           = 16 * 1024
	maxHealthRequestBytes            = 64 * 1024
	minimumControlTokenLength        = 32
	componentHookRequestTimeout      = 5 * time.Second
	proxyDirections                  = 2
)

func boundedControlRequests() echo.MiddlewareFunc {
	slots := make(chan struct{}, maximumConcurrentControlRequests)
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			select {
			case slots <- struct{}{}:
				defer func() { <-slots }()
			default:
				return writeProblem(c, http.StatusServiceUnavailable, "GUEST_CONTROL_BUSY", "Guest control request capacity is exhausted", true, retryAfterDetails())
			}
			if c.Request().Method == http.MethodConnect {
				return next(c)
			}
			ctx, cancel := context.WithTimeout(c.Request().Context(), controlHandlerDeadline)
			defer cancel()
			c.SetRequest(c.Request().WithContext(ctx))
			return next(c)
		}
	}
}
