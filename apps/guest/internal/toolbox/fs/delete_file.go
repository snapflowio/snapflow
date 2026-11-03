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

// @Summary		Delete a file or directory
// @Description	Delete a file or directory at the specified path
// @Tags			file-system
// @Param			path		query	string	true	"File or directory path to delete"
// @Param			recursive	query	boolean	false	"Enable recursive deletion for directories"
// @Success		204
// @Router			/files [delete]
// @id				DeleteFile
func DeleteFile(c *echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("path is required").Error())
	}

	recursive := c.QueryParam("recursive") == "true"

	info, err := os.Stat(path)
	if err != nil {
		return pathError(err)
	}

	if info.IsDir() && !recursive {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("cannot delete directory without recursive flag").Error())
	}

	var deleteErr error
	if recursive {
		deleteErr = os.RemoveAll(path)
	} else {
		deleteErr = os.Remove(path)
	}

	if deleteErr != nil {
		return echo.NewHTTPError(http.StatusBadRequest, deleteErr.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
