// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/git"
	"github.com/snapflowio/guest/internal/httpx"
)

// @Summary		Delete a branch
// @Description	Delete a branch from the Git repository
// @Tags			git
// @Accept			json
// @Produce		json
// @Param			request	body	GitDeleteBranchRequest	true	"Delete branch request"
// @Success		204
// @Router			/git/branches [delete]
// @id				DeleteBranch
func DeleteBranch(c *echo.Context) error {
	var req GitDeleteBranchRequest
	if err := httpx.BindBody(c, &req); err != nil {
		return common_errors.NewInvalidBodyRequestError(fmt.Errorf("invalid request body: %w", err))
	}

	gitService := git.Service{
		WorkDir: req.Path,
	}

	if err := gitService.DeleteBranch(req.Name); err != nil {
		return classifyGitError(err)
	}

	return c.NoContent(http.StatusNoContent)
}
