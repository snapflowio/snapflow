// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"errors"
	"net/http"
	"os"

	"github.com/labstack/echo/v5"
)

func pathError(err error) error {
	switch {
	case errors.Is(err, os.ErrNotExist):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case errors.Is(err, os.ErrPermission):
		return echo.NewHTTPError(http.StatusForbidden, err.Error())
	default:
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
}

func badRequest(message string) error {
	return echo.NewHTTPError(http.StatusBadRequest, message)
}
