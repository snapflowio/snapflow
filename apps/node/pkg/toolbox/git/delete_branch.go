package git

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/snapflow/node/pkg/git"
)

func DeleteBranch(c *gin.Context) {
	var req GitDeleteBranchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	gitService := git.Service{
		ProjectDir: req.Path,
	}

	if err := gitService.DeleteBranch(req.Name); err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	c.Status(http.StatusNoContent)
}
