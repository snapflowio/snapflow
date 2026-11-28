// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package sandbox

import (
	"os"
	"strings"

	"github.com/snapflowio/common-go/pkg/guestspec"
)

const imageDefaultDirectory = "/"

func WorkDir(fallback string) string {
	if dir := strings.TrimSpace(os.Getenv(guestspec.ProjectDirEnvironment)); dir != "" && dir != imageDefaultDirectory {
		return dir
	}
	user, err := DefaultUser()
	if err != nil {
		return fallback
	}
	return user.Home
}

func CommandDir(requested *string, fallback string) string {
	if requested != nil && strings.TrimSpace(*requested) != "" {
		return *requested
	}
	return WorkDir(fallback)
}
