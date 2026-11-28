// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package util

import (
	"errors"
	"net/http"
	"os"

	"github.com/labstack/echo/v5"
)

func ServeFile(ctx *echo.Context, filePath, displayName string) (returnErr error) {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer func() {
		returnErr = errors.Join(returnErr, file.Close())
	}()

	info, err := file.Stat()
	if err != nil {
		return err
	}

	http.ServeContent(ctx.Response(), ctx.Request(), displayName, info.ModTime(), file)
	return nil
}
