package git

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/snapflow/node/pkg/git"
)

func AddFiles(c echo.Context) error {
	var req GitAddRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	gitService := git.Service{
		ProjectDir: req.Path,
	}

	if err := gitService.Add(req.Files); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusOK)
}
