package git

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/snapflow/node/pkg/git"
)

func CheckoutBranch(c *gin.Context) {
	var req GitCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithError(http.StatusBadRequest, fmt.Errorf("invalid request body: %w", err))
		return
	}

	gitService := git.Service{
		ProjectDir: req.Path,
	}

	if err := gitService.Checkout(req.Branch); err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	c.Status(http.StatusOK)
}
