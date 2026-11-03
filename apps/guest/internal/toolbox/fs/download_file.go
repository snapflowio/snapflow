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
	"path/filepath"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/util"
)

// @Summary		Download a file
// @Description	Download a file by providing its path
// @Tags			file-system
// @Produce		octet-stream
// @Param			path	query	string	true	"File path to download"
// @Success		200		{file}	binary
// @Router			/files/download [get]
// @id				DownloadFile
func DownloadFile(c *echo.Context) error {
	requestedPath := c.QueryParam("path")
	if requestedPath == "" {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("path is required").Error())
	}

	absPath, err := filepath.Abs(requestedPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Errorf("invalid path: %w", err).Error())
	}

	fileInfo, err := os.Stat(absPath)
	if err != nil {
		return pathError(err)
	}

	if fileInfo.IsDir() {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("path must be a file").Error())
	}

	header := c.Response().Header()
	header.Set("Content-Description", "File Transfer")
	header.Set(echo.HeaderContentType, echo.MIMEOctetStream)
	filename := filepath.Base(absPath)
	header.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"; filename*=utf-8''%s`,
		toLatin1(filename), encodeRFC5987(filename)))
	header.Set("Content-Transfer-Encoding", "binary")
	header.Set("Expires", "0")
	header.Set("Cache-Control", "must-revalidate")
	header.Set("Pragma", "public")

	if err := util.ServeFile(c, absPath, filename); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to serve file").Wrap(err)
	}
	return nil
}
