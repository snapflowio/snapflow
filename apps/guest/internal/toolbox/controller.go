// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package toolbox

import (
	"net/http"
	"os"

	"github.com/labstack/echo/v5"
	"github.com/snapflowio/guest/internal/buildinfo"
)

// @Summary		Get working directory
// @Description	Get the current working directory path. This is default directory used for running commands.
// @Tags			info
// @Produce		json
// @Success		200	{object}	WorkDirResponse
// @Router			/work-dir [get]
// @id				GetWorkDir
func (s *Server) GetWorkDir(ctx *echo.Context) error {
	workDir := WorkDirResponse{
		Dir: s.cfg.WorkDir,
	}

	return ctx.JSON(http.StatusOK, workDir)
}

// @Summary		Get user home directory
// @Description	Get the current user home directory path.
// @Tags			info
// @Produce		json
// @Success		200	{object}	UserHomeDirResponse
// @Router			/user-home-dir [get]
// @id				GetUserHomeDir
func (s *Server) GetUserHomeDir(ctx *echo.Context) error {
	userHomeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	userHomeDirResponse := UserHomeDirResponse{
		Dir: userHomeDir,
	}

	return ctx.JSON(http.StatusOK, userHomeDirResponse)
}

// @Summary		Get version
// @Description	Get the current daemon version
// @Tags			info
// @Produce		json
// @Success		200	{object}	map[string]string
// @Router			/version [get]
// @id				GetVersion
func (s *Server) GetVersion(ctx *echo.Context) error {
	return ctx.JSON(http.StatusOK, map[string]any{
		"version": buildinfo.Version,
	})
}
