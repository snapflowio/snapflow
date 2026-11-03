// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package cli

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"

	"github.com/snapflowio/snapflow/internal/cli/text"
)

const (
	rootUserID          = 0
	sudoBinary          = "sudo"
	sudoPreserveEnv     = "--preserve-env="
	sudoEndOfOptions    = "--"
	noColorVariable     = "NO_COLOR"
	environmentAssigner = "="
	environmentJoiner   = ","
)

func RequireRoot(command string) error {
	if os.Geteuid() == rootUserID {
		return nil
	}
	return Fail(ExitPermissionDenied, errors.New(text.NeedsRoot(command)), text.SudoHint(command))
}

func Elevate(console *Console, arguments, environ []string, denied error) error {
	sudo, err := exec.LookPath(sudoBinary)
	if err != nil {
		return denied
	}
	self, err := os.Executable()
	if err != nil {
		return errors.Join(denied, fmt.Errorf("locate the snapflow binary: %w", err))
	}
	argv := []string{sudoBinary}
	if preserved := preservedVariables(environ); len(preserved) > 0 {
		argv = append(argv, sudoPreserveEnv+strings.Join(preserved, environmentJoiner))
	}
	argv = append(argv, sudoEndOfOptions, self)
	argv = append(argv, arguments...)
	fmt.Fprintln(console.Err, console.Theme.Muted.Render(text.Elevating))
	if err := syscall.Exec(sudo, argv, environ); err != nil {
		return errors.Join(denied, fmt.Errorf("run sudo: %w", err))
	}
	return nil
}

func preservedVariables(environ []string) []string {
	names := []string{}
	for _, entry := range environ {
		name, _, found := strings.Cut(entry, environmentAssigner)
		if found && (strings.HasPrefix(name, environmentPrefix) || name == noColorVariable) {
			names = append(names, name)
		}
	}
	return names
}
