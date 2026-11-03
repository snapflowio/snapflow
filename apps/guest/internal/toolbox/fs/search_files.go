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
	"path/filepath"

	"github.com/labstack/echo/v5"
)

// @Summary		Search files by pattern
// @Description	Search for files matching a specific pattern in a directory
// @Tags			file-system
// @Produce		json
// @Param			path	query		string	true	"Directory path to search in"
// @Param			pattern	query		string	true	"File pattern to match (e.g., *.txt, *.go)"
// @Success		200		{object}	SearchFilesResponse
// @Router			/files/search [get]
// @id				SearchFiles
func SearchFiles(c *echo.Context) error {
	path := c.QueryParam("path")
	pattern := c.QueryParam("pattern")
	if path == "" || pattern == "" {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("path and pattern are required").Error())
	}

	matches := []string{}
	err := filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return filepath.SkipDir
		}
		matched, matchErr := filepath.Match(pattern, info.Name())
		if matchErr != nil {
			return matchErr
		}
		if matched {
			matches = append(matches, path)
		}
		return nil
	})
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, SearchFilesResponse{
		Files: matches,
	})
}
