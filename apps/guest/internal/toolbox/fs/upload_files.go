// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v5"
)

const (
	uploadDirectoryMode = 0o755
	uploadFileMode      = 0o644
	uploadFieldPrefix   = "files["
	pathFieldSuffix     = "].path"
	fileFieldSuffix     = "].file"
	temporarySuffix     = ".upload-*"
)

type fileResult struct {
	Path  string `json:"path"`
	Bytes int64  `json:"bytes"`
}

type bulkUpload struct {
	destinations map[string]string
	errors       []string
	files        []fileResult
}

// @Summary		Upload multiple files
// @Description	Upload multiple files with their destination paths
// @Tags			file-system
// @Accept			multipart/form-data
// @Success		200
// @Router			/files/bulk-upload [post]
// @id				UploadFiles
func UploadFiles(c *echo.Context) error {
	if err := enableFullDuplex(c); err != nil {
		return fmt.Errorf("enable full-duplex upload: %w", err)
	}
	reader, err := c.Request().MultipartReader()
	if err != nil {
		if drainErr := drainBody(c); drainErr != nil {
			return errors.Join(err, drainErr)
		}
		return c.JSON(http.StatusBadRequest, map[string]any{"errors": []string{"invalid multipart form"}})
	}
	upload := &bulkUpload{destinations: make(map[string]string)}
	upload.consume(reader)
	if err := drainBody(c); err != nil {
		upload.fail("draining request body: %v", err)
	}
	if len(upload.errors) > 0 {
		return c.JSON(http.StatusBadRequest, map[string]any{"errors": upload.errors, "files": upload.files})
	}
	return c.JSON(http.StatusOK, map[string]any{"files": upload.files})
}

func (u *bulkUpload) fail(format string, args ...any) {
	u.errors = append(u.errors, fmt.Sprintf(format, args...))
}

func (u *bulkUpload) consume(reader *multipart.Reader) {
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			return
		}
		if err != nil {
			u.fail("reading part: %v", err)
			return
		}
		name := part.FormName()
		switch {
		case strings.HasSuffix(name, pathFieldSuffix):
			u.readPathPart(fieldIndex(name), part)
		case strings.HasSuffix(name, fileFieldSuffix):
			u.writeFilePart(fieldIndex(name), part)
		}
	}
}

func (u *bulkUpload) readPathPart(index string, part io.Reader) {
	data, err := io.ReadAll(part)
	if err != nil {
		u.fail("path[%s]: %v", index, err)
		return
	}
	destination := strings.TrimSpace(string(data))
	if destination == "" {
		u.fail("path[%s]: empty path", index)
		return
	}
	u.destinations[index] = destination
}

func (u *bulkUpload) writeFilePart(index string, part io.Reader) {
	destination, ok := u.destinations[index]
	if !ok {
		u.fail("file[%s]: missing .path metadata", index)
		return
	}
	if err := os.MkdirAll(filepath.Dir(destination), uploadDirectoryMode); err != nil {
		u.fail("%s: mkdir: %v", destination, err)
		return
	}
	written, err := writeFile(destination, part)
	if err != nil {
		u.fail("%s: %v", destination, err)
		return
	}
	u.files = append(u.files, fileResult{Path: destination, Bytes: written})
}

func writeFile(destination string, source io.Reader) (written int64, resultErr error) {
	temporary, err := os.CreateTemp(filepath.Dir(destination), filepath.Base(destination)+temporarySuffix)
	if err != nil {
		return 0, fmt.Errorf("create: %w", err)
	}
	defer func() {
		if resultErr != nil {
			resultErr = errors.Join(resultErr, os.Remove(temporary.Name()))
		}
	}()
	written, copyErr := io.Copy(temporary, source)
	if err := errors.Join(copyErr, temporary.Chmod(uploadFileMode), temporary.Close()); err != nil {
		return written, fmt.Errorf("write: %w", err)
	}
	if err := os.Rename(temporary.Name(), destination); err != nil {
		return written, fmt.Errorf("install: %w", err)
	}
	return written, nil
}

func drainBody(c *echo.Context) error {
	bytesDrained, err := io.Copy(io.Discard, c.Request().Body)
	if err != nil {
		return fmt.Errorf("drain request body after %d bytes: %w", bytesDrained, err)
	}
	return nil
}

func enableFullDuplex(c *echo.Context) error {
	err := http.NewResponseController(c.Response()).EnableFullDuplex()
	if errors.Is(err, http.ErrNotSupported) {
		return nil
	}
	return err
}

func fieldIndex(fieldName string) string {
	index := strings.TrimPrefix(fieldName, uploadFieldPrefix)
	return strings.TrimSuffix(strings.TrimSuffix(index, pathFieldSuffix), fileFieldSuffix)
}
