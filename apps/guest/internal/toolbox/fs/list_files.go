// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v5"
)

// @Summary		List files and directories
// @Description	List files and directories in the specified path
// @Tags			file-system
// @Produce		json
// @Param			path	query	string	false	"Directory path to list (defaults to working directory)"
// @Success		200		{array}	FileInfo
// @Router			/files [get]
// @id				ListFiles
func ListFiles(c *echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		path = "."
	}

	files, err := os.ReadDir(path)
	if err != nil {
		return pathError(err)
	}

	fileInfos := make([]FileInfo, 0)
	for _, file := range files {
		info, err := getFileInfo(filepath.Join(path, file.Name()))
		if err != nil {
			continue
		}
		fileInfos = append(fileInfos, info)
	}

	return c.JSON(http.StatusOK, fileInfos)
}
