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

// @Summary		Push changes to remote
// @Description	Push local changes to the remote Git repository
// @Tags			git
// @Accept			json
// @Produce		json
// @Param			request	body	GitRepoRequest	true	"Push request"
// @Success		200
// @Router			/git/push [post]
// @id				PushChanges
func PushChanges(c *echo.Context) error {
	return remoteOperation(c, (*git.Service).Push)
}
