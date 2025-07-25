package fs

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
)

func SearchFiles(c echo.Context) error {
	path := c.QueryParam("path")
	pattern := c.QueryParam("pattern")
	if path == "" || pattern == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path and pattern are required")
	}

	var matches []string
	err := filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return filepath.SkipDir
		}
		if matched, _ := filepath.Match(pattern, info.Name()); matched {
			matches = append(matches, path)
		}
		return nil
	})

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, SearchFilesResponse{
		Files: matches,
	})
}
