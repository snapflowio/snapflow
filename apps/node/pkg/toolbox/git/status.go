package git

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/snapflow/node/pkg/git"
)

func GetStatus(c *gin.Context) {
	path := c.Query("path")
	if path == "" {
		c.AbortWithError(http.StatusBadRequest, errors.New("path is required"))
		return
	}

	gitService := git.Service{
		ProjectDir: path,
	}

	status, err := gitService.GetGitStatus()
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	c.JSON(http.StatusOK, status)
}
