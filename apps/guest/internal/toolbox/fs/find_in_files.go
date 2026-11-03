// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"bufio"
	"bytes"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v5"
)

const binarySniffLength = 512

// @Summary		Find text in files
// @Description	Search for text pattern within files in a directory
// @Tags			file-system
// @Produce		json
// @Param			path	query	string	true	"Directory path to search in"
// @Param			pattern	query	string	true	"Text pattern to search for"
// @Success		200		{array}	Match
// @Router			/files/find [get]
// @id				FindInFiles
func FindInFiles(c *echo.Context) error {
	root := c.QueryParam("path")
	pattern := c.QueryParam("pattern")
	if root == "" || pattern == "" {
		return badRequest("path and pattern are required")
	}
	matches := make([]Match, 0)
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			if entry != nil && entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.Type().IsRegular() {
			matches = append(matches, searchFile(path, pattern)...)
		}
		return nil
	})
	if err != nil {
		return badRequest(err.Error())
	}
	return c.JSON(http.StatusOK, matches)
}

func searchFile(path, pattern string) []Match {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()
	reader := bufio.NewReader(file)
	head, err := reader.Peek(binarySniffLength)
	if (err != nil && !errors.Is(err, io.EOF)) || len(head) == 0 || bytes.IndexByte(head, 0) >= 0 {
		return nil
	}
	var matches []Match
	scanner := bufio.NewScanner(reader)
	for line := 1; scanner.Scan(); line++ {
		if text := scanner.Text(); strings.Contains(text, pattern) {
			matches = append(matches, Match{File: path, Line: line, Content: text})
		}
	}
	return matches
}
