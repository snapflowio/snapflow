package git

import (
	"fmt"
	"net/http"

	go_git_http "github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/labstack/echo/v4"
	"github.com/snapflow/node/pkg/git"
	"github.com/snapflow/node/pkg/provider"
)

func CloneRepository(c echo.Context) error {
	var req GitCloneRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	branch := "main"
	if req.Branch != nil {
		branch = *req.Branch
	}

	repo := provider.GitRepository{
		Url:    req.URL,
		Branch: branch,
	}

	if req.CommitID != nil {
		repo.Target = provider.CloneTargetCommit
		repo.Sha = *req.CommitID
	}

	gitService := git.Service{
		ProjectDir: req.Path,
	}

	var auth *go_git_http.BasicAuth

	if req.Username != nil && req.Password != nil {
		auth = &go_git_http.BasicAuth{
			Username: *req.Username,
			Password: *req.Password,
		}
	}

	err := gitService.CloneRepository(&repo, auth)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusOK)
}
