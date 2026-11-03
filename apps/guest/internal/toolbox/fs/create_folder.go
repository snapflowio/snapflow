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
	"strconv"

	"github.com/labstack/echo/v5"
)

// @Summary		Create a folder
// @Description	Create a folder with the specified path and optional permissions
// @Tags			file-system
// @Accept			json
// @Param			path	query	string	true	"Folder path to create"
// @Param			mode	query	string	true	"Octal permission mode (default: 0755)"
// @Success		201
// @Router			/files/folder [post]
// @id				CreateFolder
func CreateFolder(c *echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("path is required").Error())
	}

	mode := c.QueryParam("mode")
	var perm os.FileMode = 0o755
	if mode != "" {
		modeNum, err := strconv.ParseUint(mode, 8, 32)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, errors.New("invalid mode format").Error())
		}
		perm = os.FileMode(modeNum)
	}

	if err := os.MkdirAll(path, perm); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusCreated)
}
