// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import (
	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/git"
)

// @Summary		Pull changes from remote
// @Description	Pull changes from the remote Git repository
// @Tags			git
// @Accept			json
// @Produce		json
// @Param			request	body	GitRepoRequest	true	"Pull request"
// @Success		200
// @Router			/git/pull [post]
// @id				PullChanges
func PullChanges(c *echo.Context) error {
	return remoteOperation(c, (*git.Service).Pull)
}
