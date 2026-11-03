// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/common"
	"github.com/snapflowio/guest/internal/httpx"
)

// @Summary		Download multiple files
// @Description	Download multiple files by providing their paths. Successful files are returned as multipart parts named `file`. Per-file failures are returned as multipart parts named `error` with JSON payloads shaped like ErrorResponse.
// @Tags			file-system
// @Accept			json
// @Produce		multipart/form-data
// @Param			downloadFiles	body		FilesDownloadRequest	true	"Paths of files to download"
// @Success		200				{object}	map[string]any			"Multipart response with file parts and JSON error parts"
// @Router			/files/bulk-download [post]
// @id				DownloadFiles
func DownloadFiles(c *echo.Context) error {
	var req FilesDownloadRequest
	if err := httpx.BindBody(c, &req); err != nil || len(req.Paths) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error": "request body must be {\"paths\": [ ... ]} and non-empty",
		})
	}

	const boundary = "SNAPFLOW-FILE-BOUNDARY"
	c.Response().Header().Set(echo.HeaderContentType, fmt.Sprintf("multipart/form-data; boundary=%s", boundary))

	mw := multipart.NewWriter(c.Response())
	if err := mw.SetBoundary(boundary); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{
			"error": "failed to set multipart boundary",
		})
	}

	for _, path := range req.Paths {
		if err := writeDownload(c, mw, path); err != nil {
			return err
		}
	}

	if err := mw.Close(); err != nil {
		return fmt.Errorf("close multipart writer: %w", err)
	}
	return flushResponse(c)
}

func flushResponse(c *echo.Context) error {
	return http.NewResponseController(c.Response()).Flush()
}

func writeDownload(c *echo.Context, mw *multipart.Writer, path string) error {
	file, info, downloadErr := openDownloadFile(c, path)
	if downloadErr != nil {
		return writeErrorPart(mw, path, *downloadErr)
	}
	writeErr := writeFilePart(mw, path, file, info.Size())
	if err := errors.Join(writeErr, file.Close()); err != nil {
		return fmt.Errorf("write downloaded file %q: %w", path, err)
	}
	return nil
}

func writeFilePart(mw *multipart.Writer, path string, r io.Reader, size int64) error {
	ctype := mime.TypeByExtension(filepath.Ext(path))
	if ctype == "" {
		ctype = "application/octet-stream"
	}

	hdr := textproto.MIMEHeader{}
	hdr.Set("Content-Type", ctype)
	hdr.Set("Content-Disposition", multipartContentDisposition("file", path))
	hdr.Set("Content-Length", strconv.FormatInt(size, 10))

	part, err := mw.CreatePart(hdr)
	if err != nil {
		return err
	}

	written, err := io.Copy(part, r)
	if err != nil {
		return err
	}
	if written != size {
		return fmt.Errorf("wrote %d bytes for %q, expected %d", written, path, size)
	}
	return nil
}

func writeErrorPart(mw *multipart.Writer, path string, errorResponse common.ErrorResponse) error {
	payload, err := json.Marshal(errorResponse)
	if err != nil {
		return err
	}

	hdr := textproto.MIMEHeader{}
	hdr.Set("Content-Type", "application/json; charset=utf-8")
	hdr.Set("Content-Disposition", multipartContentDisposition("error", path))

	part, err := mw.CreatePart(hdr)
	if err != nil {
		return err
	}
	if _, err := part.Write(payload); err != nil {
		return err
	}
	return nil
}

func openDownloadFile(ctx *echo.Context, path string) (*os.File, os.FileInfo, *common.ErrorResponse) {
	if path == "" {
		errorResponse := newFileDownloadErrorResponse(
			ctx,
			path,
			http.StatusBadRequest,
			"INVALID_FILE_PATH",
			"invalid file path: path is empty",
		)
		return nil, nil, &errorResponse
	}

	f, err := os.Open(path)
	if err != nil {
		errorResponse := classifyOpenFileError(ctx, path, err)
		return nil, nil, &errorResponse
	}

	info, err := f.Stat()
	if err != nil {
		if closeErr := f.Close(); closeErr != nil {
			err = errors.Join(err, closeErr)
		}
		statusCode, errorCode, message := classifyPathStatError(path, err)
		errorResponse := newFileDownloadErrorResponse(ctx, path, statusCode, errorCode, message)
		return nil, nil, &errorResponse
	}

	if info.IsDir() {
		if closeErr := f.Close(); closeErr != nil {
			errorResponse := newFileDownloadErrorResponse(ctx, path, http.StatusInternalServerError, "FILE_CLOSE_FAILED", closeErr.Error())
			return nil, nil, &errorResponse
		}
		errorResponse := newFileDownloadErrorResponse(
			ctx,
			path,
			http.StatusBadRequest,
			"INVALID_FILE_PATH",
			fmt.Sprintf("invalid file path: path points to a directory: %s", path),
		)
		return nil, nil, &errorResponse
	}

	return f, info, nil
}

func multipartContentDisposition(formName, path string) string {
	return fmt.Sprintf(`form-data; name="%s"; filename="%s"; filename*=utf-8''%s`,
		formName, toLatin1(path), encodeRFC5987(path))
}

func classifyPathStatError(path string, err error) (int, string, string) {
	if errors.Is(err, os.ErrNotExist) {
		return http.StatusNotFound, "FILE_NOT_FOUND", fmt.Sprintf("file not found: %s", path)
	}

	if errors.Is(err, os.ErrPermission) {
		return http.StatusForbidden, "FILE_ACCESS_DENIED", fmt.Sprintf("permission denied: %s", path)
	}

	if errors.Is(err, os.ErrInvalid) {
		return http.StatusBadRequest, "INVALID_FILE_PATH", fmt.Sprintf("invalid file path: %s", path)
	}

	return http.StatusInternalServerError, "FILE_READ_FAILED", fmt.Sprintf("failed to access file: %v", err)
}

func classifyOpenFileError(ctx *echo.Context, path string, err error) common.ErrorResponse {
	statusCode, errorCode, message := classifyPathStatError(path, err)
	if errorCode == "FILE_READ_FAILED" {
		message = fmt.Sprintf("failed to open file: %v", err)
	}
	return newFileDownloadErrorResponse(ctx, path, statusCode, errorCode, message)
}

func newFileDownloadErrorResponse(
	ctx *echo.Context,
	path string,
	statusCode int,
	code string,
	message string,
) common.ErrorResponse {
	return common.ErrorResponse{
		StatusCode: statusCode,
		Message:    message,
		Code:       code,
		Timestamp:  time.Now().UTC(),
		Path:       path,
		Method:     ctx.Request().Method,
	}
}

const maxLatin1 = 0xFF

func toLatin1(s string) string {
	escaped := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\r", "", "\n", "", "\x00", "").Replace(s)
	var buf []byte
	for _, r := range escaped {
		if r > maxLatin1 {
			buf = append(buf, '_')
		} else if r < 0x20 || r == 0x7F {
			buf = append(buf, '_')
		} else {
			buf = append(buf, byte(r))
		}
	}
	return string(buf)
}

func encodeRFC5987(s string) string {
	var buf []byte
	for _, b := range []byte(s) {
		if isAttrChar(b) {
			buf = append(buf, b)
		} else {
			buf = append(buf, fmt.Sprintf("%%%02X", b)...)
		}
	}
	return string(buf)
}

func isAttrChar(b byte) bool {
	switch {
	case b >= 'a' && b <= 'z':
		return true
	case b >= 'A' && b <= 'Z':
		return true
	case b >= '0' && b <= '9':
		return true
	}
	switch b {
	case '!', '#', '$', '&', '+', '-', '.', '^', '_', '`', '|', '~':
		return true
	}
	return false
}
