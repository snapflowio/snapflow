// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package common

import (
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/snapflowio/guest/internal/sandbox"
)

const (
	shellsFile       = "/etc/shells"
	shellEnvironment = "SHELL"
	fallbackShell    = "sh"
)

func interactiveShells() []string {
	return []string{"/usr/bin/zsh", "/bin/zsh", "/usr/bin/bash", "/bin/bash"}
}

func scriptShells() []string {
	return []string{"/usr/bin/bash", "/bin/bash"}
}

func GetShell() string {
	if shell, found := installedShell(interactiveShells()); found {
		return shell
	}
	if shell, set := os.LookupEnv(shellEnvironment); set {
		return shell
	}
	return fallbackShell
}

func GetScriptShell() string {
	if shell, found := installedShell(scriptShells()); found {
		return shell
	}
	return fallbackShell
}

func installedShell(candidates []string) (string, bool) {
	content, err := os.ReadFile(shellsFile)
	if err != nil {
		return "", false
	}
	installed := strings.Fields(string(content))
	for _, shell := range candidates {
		if slices.Contains(installed, shell) {
			return shell, true
		}
	}
	return "", false
}

func LoginShell(user sandbox.User) string {
	if user.Shell != "" && !slices.Contains(disabledShells(), filepath.Base(user.Shell)) {
		if info, err := os.Stat(user.Shell); err == nil && info.Mode().IsRegular() {
			return user.Shell
		}
	}
	return GetShell()
}

func disabledShells() []string {
	return []string{"nologin", "false"}
}
