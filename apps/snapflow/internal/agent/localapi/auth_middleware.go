// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package localapi

import (
	"crypto/subtle"
	"errors"
	"strings"

	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
)

const (
	authorizationHeader         = "Authorization"
	bearerAuthorizationScheme   = "Bearer"
	snapflowAuthorizationHeader = "X-Snapflow-Authorization"
)

func authMiddleware(connectionToken string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(ctx *echo.Context) error {
			authHeader := ctx.Request().Header.Get(snapflowAuthorizationHeader)
			if authHeader == "" {
				authHeader = ctx.Request().Header.Get(authorizationHeader)
			}

			ctx.Request().Header.Del(snapflowAuthorizationHeader)

			if authHeader == "" {
				return common_errors.NewUnauthorizedError(errors.New("authorization header required"))
			}

			parts := strings.Fields(authHeader)
			if len(parts) != 2 || parts[0] != bearerAuthorizationScheme {
				return common_errors.NewUnauthorizedError(errors.New("invalid authorization header format"))
			}

			token := parts[1]

			if subtle.ConstantTimeCompare([]byte(token), []byte(connectionToken)) != 1 {
				return common_errors.NewUnauthorizedError(errors.New("invalid token"))
			}

			return next(ctx)
		}
	}
}
