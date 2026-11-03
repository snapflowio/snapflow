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
	"mime/multipart"
	"net/http"

	"github.com/labstack/echo/v5"
)

// @Summary		Upload a file
// @Description	Upload a file to the specified path
// @Tags			file-system
// @Accept			multipart/form-data
// @Param			path	query		string	true	"Destination path for the uploaded file"
// @Param			file	formData	file	true	"File to upload"
// @Success		200		{object}	map[string]any
// @Router			/files/upload [post]
// @id				UploadFile
func UploadFile(c *echo.Context) (handlerErr error) {
	if err := enableFullDuplex(c); err != nil {
		return fmt.Errorf("enable full-duplex upload: %w", err)
	}
	defer func() {
		handlerErr = errors.Join(handlerErr, drainBody(c))
	}()

	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, errors.New("path is required").Error())
	}

	file, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if err := saveUploadedFile(file, path); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusOK)
}

func saveUploadedFile(header *multipart.FileHeader, destination string) (resultErr error) {
	source, err := header.Open()
	if err != nil {
		return fmt.Errorf("open uploaded file: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, source.Close())
	}()
	written, err := writeFile(destination, source)
	if err != nil {
		return fmt.Errorf("save uploaded file: %w", err)
	}
	if written != header.Size {
		return fmt.Errorf("save uploaded file: copied %d bytes, expected %d", written, header.Size)
	}
	return nil
}
