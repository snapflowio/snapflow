package fs

import (
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
)

func DeleteFile(c echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path is required")
	}

	recursive := c.QueryParam("recursive") == "true"

	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		if os.IsPermission(err) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if info.IsDir() && !recursive {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot delete directory without recursive flag")
	}

	var deleteErr error
	if recursive {
		deleteErr = os.RemoveAll(path)
	} else {
		deleteErr = os.Remove(path)
	}

	if deleteErr != nil {
		return echo.NewHTTPError(http.StatusBadRequest, deleteErr.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
