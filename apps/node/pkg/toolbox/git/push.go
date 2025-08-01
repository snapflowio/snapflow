package git

import (
	"fmt"
	"net/http"

	go_git "github.com/go-git/go-git/v5"
	go_git_http "github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/labstack/echo/v4"
	"github.com/snapflowio/node/pkg/git"
)

func PushChanges(c echo.Context) error {
	var req GitRepoRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	var auth *go_git_http.BasicAuth
	if req.Username != nil && req.Password != nil {
		auth = &go_git_http.BasicAuth{
			Username: *req.Username,
			Password: *req.Password,
		}
	}

	gitService := git.Service{
		ProjectDir: req.Path,
	}

	err := gitService.Push(auth)
	if err != nil && err != go_git.NoErrAlreadyUpToDate {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusOK)
}
