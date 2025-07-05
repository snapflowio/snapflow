package git

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	go_git_http "github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/snapflow/node/pkg/git"
	"github.com/snapflow/node/pkg/provider"
)

func CloneRepository(c *gin.Context) {
	var req GitCloneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
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
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	c.Status(http.StatusOK)
}
