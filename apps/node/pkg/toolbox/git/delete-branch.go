package git

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/snapflowio/node/pkg/git"
)

func DeleteBranch(c echo.Context) error {
	var req GitDeleteBranchRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	gitService := git.Service{
		ProjectDir: req.Path,
	}

	if err := gitService.DeleteBranch(req.Name); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
