// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package fs

import (
	"fmt"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strconv"

	"github.com/labstack/echo/v5"
)

const (
	octalBase      = 8
	modeBits       = 32
	unchangedOwner = -1
)

// @Summary		Set file permissions
// @Description	Set file permissions, ownership, and group for a file or directory
// @Tags			file-system
// @Param			path	query	string	true	"File or directory path"
// @Param			owner	query	string	false	"Owner (username or UID)"
// @Param			group	query	string	false	"Group (group name or GID)"
// @Param			mode	query	string	false	"File mode in octal format (e.g., 0755)"
// @Success		200
// @Router			/files/permissions [post]
// @id				SetFilePermissions
func SetFilePermissions(c *echo.Context) error {
	path := c.QueryParam("path")
	if path == "" {
		return badRequest("path is required")
	}
	absPath, err := filepath.Abs(path)
	if err != nil {
		return badRequest("invalid path")
	}
	fileInfo, err := os.Stat(absPath)
	if err != nil {
		return pathError(err)
	}
	if !fileInfo.IsDir() && !fileInfo.Mode().IsRegular() {
		return badRequest("path must be a regular file or directory")
	}
	if err := applyMode(absPath, c.QueryParam("mode")); err != nil {
		return err
	}
	if err := applyOwnership(absPath, c.QueryParam("owner"), c.QueryParam("group")); err != nil {
		return err
	}
	return c.NoContent(http.StatusOK)
}

func applyMode(path, mode string) error {
	if mode == "" {
		return nil
	}
	parsed, err := strconv.ParseUint(mode, octalBase, modeBits)
	if err != nil {
		return badRequest("invalid mode format")
	}
	if err := os.Chmod(path, os.FileMode(parsed)); err != nil {
		return badRequest(fmt.Sprintf("failed to change mode: %v", err))
	}
	return nil
}

func applyOwnership(path, owner, group string) error {
	if owner == "" && group == "" {
		return nil
	}
	uid, err := resolveID(owner, lookupUserID, "user")
	if err != nil {
		return err
	}
	gid, err := resolveID(group, lookupGroupID, "group")
	if err != nil {
		return err
	}
	if err := os.Chown(path, uid, gid); err != nil {
		return badRequest(fmt.Sprintf("failed to change ownership: %v", err))
	}
	return nil
}

func resolveID(name string, lookup func(string) (string, error), kind string) (int, error) {
	if name == "" {
		return unchangedOwner, nil
	}
	if id, err := strconv.Atoi(name); err == nil {
		return id, nil
	}
	resolved, err := lookup(name)
	if err != nil {
		return 0, badRequest(kind + " not found")
	}
	id, err := strconv.Atoi(resolved)
	if err != nil {
		return 0, badRequest("invalid " + kind + " ID")
	}
	return id, nil
}

func lookupUserID(name string) (string, error) {
	found, err := user.Lookup(name)
	if err != nil {
		return "", err
	}
	return found.Uid, nil
}

func lookupGroupID(name string) (string, error) {
	found, err := user.LookupGroup(name)
	if err != nil {
		return "", err
	}
	return found.Gid, nil
}
