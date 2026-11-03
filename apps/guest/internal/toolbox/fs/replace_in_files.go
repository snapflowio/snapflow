// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/httpx"
)

const replacedFileMode = 0o644

// @Summary		Replace text in files
// @Description	Replace text pattern with new value in multiple files
// @Tags			file-system
// @Accept			json
// @Produce		json
// @Param			request	body	ReplaceRequest	true	"Replace request"
// @Success		200		{array}	ReplaceResult
// @Router			/files/replace [post]
// @id				ReplaceInFiles
func ReplaceInFiles(c *echo.Context) error {
	var req ReplaceRequest
	if err := httpx.BindBody(c, &req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err).Error())
	}

	results := make([]ReplaceResult, 0, len(req.Files))

	for _, filePath := range req.Files {
		content, err := os.ReadFile(filePath)
		if err != nil {
			results = append(results, ReplaceResult{
				File:    filePath,
				Success: false,
				Error:   err.Error(),
			})
			continue
		}

		newValue := ""
		if req.NewValue != nil {
			newValue = *req.NewValue
		}

		newContent := strings.ReplaceAll(string(content), req.Pattern, newValue)

		err = os.WriteFile(filePath, []byte(newContent), replacedFileMode)
		if err != nil {
			results = append(results, ReplaceResult{
				File:    filePath,
				Success: false,
				Error:   err.Error(),
			})
			continue
		}

		results = append(results, ReplaceResult{
			File:    filePath,
			Success: true,
		})
	}

	return c.JSON(http.StatusOK, results)
}
