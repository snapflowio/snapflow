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

// @Summary		Clone a Git repository
// @Description	Clone a Git repository to the specified path. Defaults to strict TLS verification; set insecure_skip_tls=true to skip verification for self-signed or private-CA Git servers.
// @Tags			git
// @Accept			json
// @Produce		json
// @Param			request	body	GitCloneRequest	true	"Clone repository request"
// @Success		200
// @Router			/git/clone [post]
// @id				CloneRepository
func CloneRepository(c *echo.Context) error {
	var req GitCloneRequest
	if err := httpx.BindBody(c, &req); err != nil {
		return common_errors.NewInvalidBodyRequestError(fmt.Errorf("invalid request body: %w", err))
	}

	options := git.CloneOptions{
		URL:             req.URL,
		Auth:            basicAuth(req.Username, req.Password),
		InsecureSkipTLS: req.InsecureSkipTLS != nil && *req.InsecureSkipTLS,
	}
	if req.Branch != nil {
		options.Branch = *req.Branch
	}
	if req.CommitID != nil {
		options.CommitSHA = *req.CommitID
	}
	gitService := git.Service{WorkDir: req.Path}
	if err := gitService.Clone(options); err != nil {
		return classifyGitError(err)
	}

	return c.NoContent(http.StatusOK)
}
