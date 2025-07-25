package fs

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
)

func ListFiles(c echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		path = "."
	}

	files, err := os.ReadDir(path)
	if err != nil {
		if os.IsNotExist(err) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		if os.IsPermission(err) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	var fileInfos []FileInfo = make([]FileInfo, 0)
	for _, file := range files {
		info, err := getFileInfo(filepath.Join(path, file.Name()))
		if err != nil {
			continue
		}

		fileInfos = append(fileInfos, info)
	}

	return c.JSON(http.StatusOK, fileInfos)
}
