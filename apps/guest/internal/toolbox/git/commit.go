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
	"time"

	go_git "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/git"
	"github.com/snapflowio/guest/internal/httpx"
)

// @Summary		Commit changes
// @Description	Commit staged changes to the Git repository
// @Tags			git
// @Accept			json
// @Produce		json
// @Param			request	body		GitCommitRequest	true	"Commit request"
// @Success		200		{object}	GitCommitResponse
// @Router			/git/commit [post]
// @id				CommitChanges
func CommitChanges(c *echo.Context) error {
	var req GitCommitRequest
	if err := httpx.BindBody(c, &req); err != nil {
		return common_errors.NewInvalidBodyRequestError(fmt.Errorf("invalid request body: %w", err))
	}

	gitService := git.Service{
		WorkDir: req.Path,
	}

	commitSha, err := gitService.Commit(req.Message, &go_git.CommitOptions{
		Author: &object.Signature{
			Name:  req.Author,
			Email: req.Email,
			When:  time.Now(),
		},
		AllowEmptyCommits: req.AllowEmpty,
	})
	if err != nil {
		return classifyGitError(err)
	}

	return c.JSON(http.StatusOK, GitCommitResponse{
		Hash: commitSha,
	})
}
