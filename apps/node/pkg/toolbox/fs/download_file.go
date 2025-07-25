package fs

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
)

func DownloadFile(c echo.Context) error {
	requestedPath := c.QueryParam("path")
	if requestedPath == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path is required")
	}

	absPath, err := filepath.Abs(requestedPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid path: %v", err))
	}

	fileInfo, err := os.Stat(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		if os.IsPermission(err) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if fileInfo.IsDir() {
		return echo.NewHTTPError(http.StatusBadRequest, "path must be a file")
	}

	c.Response().Header().Set("Content-Description", "File Transfer")
	c.Response().Header().Set("Content-Type", "application/octet-stream")
	c.Response().Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(absPath))
	c.Response().Header().Set("Content-Transfer-Encoding", "binary")
	c.Response().Header().Set("Expires", "0")
	c.Response().Header().Set("Cache-Control", "must-revalidate")
	c.Response().Header().Set("Pragma", "public")

	return c.File(absPath)
}
