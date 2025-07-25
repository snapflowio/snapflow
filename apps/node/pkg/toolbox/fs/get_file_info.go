package fs

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"syscall"

	"github.com/labstack/echo/v4"
)

func GetFileInfo(c echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path is required")
	}

	info, err := getFileInfo(path)
	if err != nil {
		if os.IsNotExist(err) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		if os.IsPermission(err) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, info)
}

func getFileInfo(path string) (FileInfo, error) {
	info, err := os.Stat(path)
	if err != nil {
		return FileInfo{}, err
	}

	stat := info.Sys().(*syscall.Stat_t)
	return FileInfo{
		Name:        info.Name(),
		Size:        info.Size(),
		Mode:        info.Mode().String(),
		ModTime:     info.ModTime().String(),
		IsDir:       info.IsDir(),
		Owner:       strconv.FormatUint(uint64(stat.Uid), 10),
		Group:       strconv.FormatUint(uint64(stat.Gid), 10),
		Permissions: fmt.Sprintf("%04o", info.Mode().Perm()),
	}, nil
}
