package git

import (
	"fmt"
	"net/http"
	"time"

	go_git "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/labstack/echo/v4"
	"github.com/snapflow/node/pkg/git"
)

func CommitChanges(c echo.Context) error {
	var req GitCommitRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	gitService := git.Service{
		ProjectDir: req.Path,
	}

	commitSha, err := gitService.Commit(req.Message, &go_git.CommitOptions{
		Author: &object.Signature{
			Name:  req.Author,
			Email: req.Email,
			When:  time.Now(),
		},
	})

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, GitCommitResponse{
		Hash: commitSha,
	})
}
