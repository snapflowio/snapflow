// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package httpx

import (
	"github.com/labstack/echo/v5"
)

func BindBody(ctx *echo.Context, target any) error {
	if err := echo.BindBody(ctx, target); err != nil {
		return err
	}
	return validate(ctx, target)
}

func BindQuery(ctx *echo.Context, target any) error {
	if err := echo.BindQueryParams(ctx, target); err != nil {
		return err
	}
	return validate(ctx, target)
}

func validate(ctx *echo.Context, target any) error {
	if ctx.Echo().Validator == nil {
		return nil
	}
	return ctx.Validate(target)
}
