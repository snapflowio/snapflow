// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/git"
)

// @Summary		Get commit history
// @Description	Get the commit history of the Git repository
// @Tags			git
// @Produce		json
// @Param			path	query	string	true	"Repository path"
// @Success		200		{array}	git.GitCommitInfo
// @Router			/git/history [get]
// @id				GetCommitHistory
func GetCommitHistory(c *echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		return common_errors.NewBadRequestError(errors.New("path is required"))
	}

	gitService := git.Service{
		WorkDir: path,
	}

	log, err := gitService.Log()
	if err != nil {
		return classifyGitError(err)
	}

	return c.JSON(http.StatusOK, log)
}
