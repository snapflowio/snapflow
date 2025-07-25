package fs

import (
	"net/http"
	"os"
	"strconv"

	"github.com/labstack/echo/v4"
)

func CreateFolder(c echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path is required")
	}

	mode := c.QueryParam("mode")
	var perm os.FileMode = 0755
	if mode != "" {
		modeNum, err := strconv.ParseUint(mode, 8, 32)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid mode format")
		}
		perm = os.FileMode(modeNum)
	}

	if err := os.MkdirAll(path, perm); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusCreated)
}
