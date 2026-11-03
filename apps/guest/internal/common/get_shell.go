// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package common

import (
	"os"
	"slices"
	"strings"
)

const (
	shellsFile       = "/etc/shells"
	shellEnvironment = "SHELL"
	fallbackShell    = "sh"
)

func preferredShells() []string {
	return []string{"/usr/bin/zsh", "/bin/zsh", "/usr/bin/bash", "/bin/bash"}
}

func GetShell() string {
	content, err := os.ReadFile(shellsFile)
	if err != nil {
		return fallbackShell
	}
	installed := strings.Fields(string(content))
	for _, shell := range preferredShells() {
		if slices.Contains(installed, shell) {
			return shell
		}
	}
	if shell, set := os.LookupEnv(shellEnvironment); set {
		return shell
	}
	return fallbackShell
}
