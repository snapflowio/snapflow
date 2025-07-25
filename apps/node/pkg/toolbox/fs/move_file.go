package fs

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
)

func MoveFile(c echo.Context) error {
	sourcePath := c.QueryParam("source")
	destPath := c.QueryParam("destination")

	if sourcePath == "" || destPath == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "source and destination paths are required")
	}

	absSourcePath, err := filepath.Abs(sourcePath)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid source path")
	}

	absDestPath, err := filepath.Abs(destPath)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid destination path")
	}

	sourceInfo, err := os.Stat(absSourcePath)
	if err != nil {
		if os.IsNotExist(err) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		if os.IsPermission(err) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	destDir := filepath.Dir(absDestPath)
	_, err = os.Stat(destDir)
	if err != nil {
		if os.IsNotExist(err) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		if os.IsPermission(err) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	if _, err := os.Stat(absDestPath); err == nil {
		return echo.NewHTTPError(http.StatusConflict, "destination already exists")
	}

	err = os.Rename(absSourcePath, absDestPath)
	if err != nil {
		if err := copyFile(absSourcePath, absDestPath, sourceInfo); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to move file: %v", err))
		}

		if err := os.RemoveAll(absSourcePath); err != nil {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"message": "file copied successfully but source could not be deleted",
				"error":   fmt.Sprintf("failed to delete source: %v", err),
			})
		}
	}

	return c.NoContent(http.StatusOK)
}

func copyFile(src, dst string, srcInfo os.FileInfo) error {
	if srcInfo.IsDir() {
		return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			relPath, err := filepath.Rel(src, path)
			if err != nil {
				return err
			}

			targetPath := filepath.Join(dst, relPath)

			if info.IsDir() {
				return os.MkdirAll(targetPath, info.Mode())
			}

			return copyFileContents(path, targetPath, info.Mode())
		})
	}
	return copyFileContents(src, dst, srcInfo.Mode())
}

func copyFileContents(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = bufio.NewReader(in).WriteTo(out)
	return err
}
