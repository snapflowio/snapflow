package fs

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
)

func UploadFiles(c echo.Context) error {
	reader, err := c.Request().MultipartReader()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"errors": []string{"invalid multipart form"}})
	}

	dests := make(map[string]string)
	var errs []string

	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			errs = append(errs, fmt.Sprintf("reading part: %v", err))
			continue
		}

		name := part.FormName()

		if strings.HasSuffix(name, ".path") {
			data, err := io.ReadAll(part)
			if err != nil {
				idx := extractIndex(name)
				errs = append(errs, fmt.Sprintf("path[%s]: %v", idx, err))
				continue
			}
			idx := extractIndex(name)
			dests[idx] = string(data)
			continue
		}

		if strings.HasSuffix(name, ".file") {
			idx := extractIndex(name)
			dest, ok := dests[idx]
			if !ok {
				errs = append(errs, fmt.Sprintf("file[%s]: missing .path metadata", idx))
				continue
			}

			if d := filepath.Dir(dest); d != "" {
				if err := os.MkdirAll(d, 0o755); err != nil {
					errs = append(errs, fmt.Sprintf("%s: mkdir %s: %v", dest, d, err))
					continue
				}
			}

			f, err := os.Create(dest)
			if err != nil {
				errs = append(errs, fmt.Sprintf("%s: create: %v", dest, err))
				continue
			}

			if _, err := io.Copy(f, part); err != nil {
				errs = append(errs, fmt.Sprintf("%s: write: %v", dest, err))
			}
			f.Close()
			continue
		}
	}

	if len(errs) > 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"errors": errs})
	}

	return c.NoContent(http.StatusOK)
}

func extractIndex(fieldName string) string {
	s := strings.TrimPrefix(fieldName, "files[")
	return strings.TrimSuffix(strings.TrimSuffix(s, "].path"), "].file")
}
