// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package git

import (
	"errors"
	"fmt"
	"net/http"

	go_git "github.com/go-git/go-git/v5"
	go_git_http "github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/labstack/echo/v5"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/git"
	"github.com/snapflowio/guest/internal/httpx"
)

func basicAuth(username, password *string) *go_git_http.BasicAuth {
	if username == nil || password == nil {
		return nil
	}
	return &go_git_http.BasicAuth{Username: *username, Password: *password}
}

func remoteOperation(c *echo.Context, operation func(*git.Service, *go_git_http.BasicAuth) error) error {
	var req GitRepoRequest
	if err := httpx.BindBody(c, &req); err != nil {
		return common_errors.NewInvalidBodyRequestError(fmt.Errorf("invalid request body: %w", err))
	}
	gitService := git.Service{WorkDir: req.Path}
	if err := operation(&gitService, basicAuth(req.Username, req.Password)); err != nil && !errors.Is(err, go_git.NoErrAlreadyUpToDate) {
		return classifyGitError(err)
	}
	return c.NoContent(http.StatusOK)
}
