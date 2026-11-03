// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package text

import (
	"fmt"

	"github.com/snapflowio/snapflow/internal/config"
)

const (
	Binary = "snapflow"
	Daemon = "snapflowd"
)

const (
	CommandSetup           = "sudo snapflow setup"
	CommandStatus          = "sudo snapflow status"
	CommandStatusWatch     = "sudo snapflow status --watch"
	CommandLogsFollow      = "sudo snapflow logs --follow"
	CommandBenchmark       = "sudo snapflow benchmark"
	CommandUpdate          = "sudo snapflow update"
	CommandDoctorIsolation = "sudo snapflow doctor --isolation"
	sudoPrefix             = "sudo "
	profileFlag            = " --profile "

	DevelopmentBootstrapTask = "moon run snapflow:dev-bootstrap"
	DevelopmentBenchmarkTask = "moon run snapflow:runtime-speed-test"
	DevelopmentServeTask     = "moon run snapflow:serve"
	DevelopmentDoctorTask    = "moon run snapflow:doctor"
)

func Run(command string) string {
	return "run `" + command + "`"
}

func ProfileCommand(command, profile string) string {
	if profile == string(config.Production) {
		return command
	}
	return command + profileFlag + profile
}

func NeedsRoot(command string) string {
	return fmt.Sprintf("`%s` manages the Snapflow service and its protected state, so it needs root", command)
}

const Elevating = "This command needs root; asking sudo to run it…"

func SudoHint(command string) string {
	return "rerun it with sudo: " + sudoPrefix + command
}

func HelpHint(commandPath string) string {
	return "see `" + commandPath + " --help`"
}
