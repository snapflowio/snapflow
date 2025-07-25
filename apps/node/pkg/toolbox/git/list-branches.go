package git

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/snapflow/node/pkg/git"
)

func ListBranches(c echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path is required")
	}

	gitService := git.Service{
		ProjectDir: path,
	}

	branchList, err := gitService.ListBranches()
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, ListBranchResponse{
		Branches: branchList,
	})
}
