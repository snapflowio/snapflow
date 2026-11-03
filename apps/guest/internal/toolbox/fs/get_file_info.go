// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"syscall"

	"github.com/labstack/echo/v5"
)

// @Summary		Get file information
// @Description	Get detailed information about a file or directory
// @Tags			file-system
// @Produce		json
// @Param			path	query		string	true	"File or directory path"
// @Success		200		{object}	FileInfo
// @Router			/files/info [get]
// @id				GetFileInfo
func GetFileInfo(c *echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("path is required").Error())
	}

	info, err := getFileInfo(path)
	if err != nil {
		return pathError(err)
	}

	return c.JSON(http.StatusOK, info)
}

const decimalBase = 10

func getFileInfo(path string) (FileInfo, error) {
	info, err := os.Stat(path)
	if err != nil {
		return FileInfo{}, err
	}

	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return FileInfo{}, fmt.Errorf("read ownership of %s: unsupported file system", path)
	}
	return FileInfo{
		Name:        info.Name(),
		Size:        info.Size(),
		Mode:        info.Mode().String(),
		ModifiedAt:  info.ModTime(),
		IsDir:       info.IsDir(),
		Owner:       strconv.FormatUint(uint64(stat.Uid), decimalBase),
		Group:       strconv.FormatUint(uint64(stat.Gid), decimalBase),
		Permissions: fmt.Sprintf("%04o", info.Mode().Perm()),
	}, nil
}
