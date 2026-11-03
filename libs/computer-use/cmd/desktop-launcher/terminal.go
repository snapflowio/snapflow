// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package main

import (
	"os"
	"syscall"
)

const (
	platformTerminalPath     = "/usr/bin/xfce4-terminal"
	platformExecutablePath   = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
	workloadShellCommand     = desktopExecutablePath + " " + workloadShellMode
	terminalTitle            = "Terminal"
	terminalDynamicTitleMode = "after"
)

func runTerminalClient() error {
	arguments := []string{
		platformTerminalPath,
		"--initial-title=" + terminalTitle,
		"--dynamic-title-mode=" + terminalDynamicTitleMode,
		"--command=" + workloadShellCommand,
	}
	return syscall.Exec(platformTerminalPath, arguments, os.Environ())
}
