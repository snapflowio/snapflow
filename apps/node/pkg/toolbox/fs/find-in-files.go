package fs

import (
	"bufio"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
)

func FindInFiles(c echo.Context) error {
	path := c.QueryParam("path")
	pattern := c.QueryParam("pattern")
	if path == "" || pattern == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path and pattern are required")
	}

	var matches []Match = make([]Match, 0)
	err := filepath.Walk(path, func(filePath string, info os.FileInfo, err error) error {
		if err != nil {
			return filepath.SkipDir
		}

		if !info.Mode().IsRegular() {
			return nil
		}

		file, err := os.Open(filePath)
		if err != nil {
			return nil
		}
		defer file.Close()

		buf := make([]byte, 512)
		n, err := file.Read(buf)
		if err != nil {
			return nil
		}

		for i := 0; i < n; i++ {
			// skip binary files
			if buf[i] == 0 {
				return nil
			}
		}

		_, err = file.Seek(0, 0)
		if err != nil {
			return nil
		}

		scanner := bufio.NewScanner(file)
		lineNum := 1
		for scanner.Scan() {
			if strings.Contains(scanner.Text(), pattern) {
				matches = append(matches, Match{
					File:    filePath,
					Line:    lineNum,
					Content: scanner.Text(),
				})
			}
			lineNum++
		}

		return nil
	})

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusOK, matches)
}
