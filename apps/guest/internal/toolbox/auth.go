// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package toolbox

import (
	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/credentials"
)

func newCredentialMiddleware(header, credentialFile string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(ctx *echo.Context) error {
			if rejection := credentials.VerifyRequest(ctx.Request(), header, credentialFile); rejection != nil {
				return echo.NewHTTPError(rejection.Status, rejection.Message).Wrap(rejection)
			}
			return next(ctx)
		}
	}
}
