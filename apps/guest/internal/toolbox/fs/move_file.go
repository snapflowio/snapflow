// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"bufio"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v5"
)

// @Summary		Move or rename file/directory
// @Description	Move or rename a file or directory from source to destination
// @Tags			file-system
// @Param			source		query	string	true	"Source file or directory path"
// @Param			destination	query	string	true	"Destination file or directory path"
// @Success		200
// @Router			/files/move [post]
// @id				MoveFile
func MoveFile(c *echo.Context) error {
	source, destination, sourceInfo, err := moveTargets(c.QueryParam("source"), c.QueryParam("destination"))
	if err != nil {
		return err
	}
	if err := os.Rename(source, destination); err == nil {
		return c.NoContent(http.StatusOK)
	}
	if err := copyFile(source, destination, sourceInfo); err != nil {
		return badRequest(fmt.Sprintf("failed to move file: %v", err))
	}
	if err := os.RemoveAll(source); err != nil {
		return c.JSON(http.StatusOK, map[string]any{
			"message": "file copied successfully but source could not be deleted",
			"error":   fmt.Sprintf("failed to delete source: %v", err),
		})
	}
	return c.NoContent(http.StatusOK)
}

func moveTargets(sourcePath, destinationPath string) (string, string, os.FileInfo, error) {
	if sourcePath == "" || destinationPath == "" {
		return "", "", nil, badRequest("source and destination paths are required")
	}
	source, err := filepath.Abs(sourcePath)
	if err != nil {
		return "", "", nil, badRequest("invalid source path")
	}
	destination, err := filepath.Abs(destinationPath)
	if err != nil {
		return "", "", nil, badRequest("invalid destination path")
	}
	sourceInfo, err := os.Stat(source)
	if err != nil {
		return "", "", nil, pathError(err)
	}
	if err := requireFreeDestination(destination); err != nil {
		return "", "", nil, err
	}
	return source, destination, sourceInfo, nil
}

func requireFreeDestination(destination string) error {
	parentInfo, err := os.Stat(filepath.Dir(destination))
	if err != nil {
		return pathError(err)
	}
	if !parentInfo.IsDir() {
		return badRequest("destination parent must be a directory")
	}
	_, err = os.Stat(destination)
	switch {
	case err == nil:
		return echo.NewHTTPError(http.StatusConflict, "destination already exists")
	case errors.Is(err, os.ErrNotExist):
		return nil
	default:
		return badRequest(err.Error())
	}
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

			return copyFileContents(path, targetPath, info)
		})
	}
	return copyFileContents(src, dst, srcInfo)
}

func copyFileContents(src, dst string, sourceInfo os.FileInfo) (returnErr error) {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer func() {
		returnErr = errors.Join(returnErr, in.Close())
	}()

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, sourceInfo.Mode())
	if err != nil {
		return err
	}
	written, writeErr := bufio.NewReader(in).WriteTo(out)
	closeErr := out.Close()
	if err := errors.Join(writeErr, closeErr); err != nil {
		return err
	}
	if written != sourceInfo.Size() {
		return fmt.Errorf("copied %d bytes, expected %d", written, sourceInfo.Size())
	}
	return nil
}
