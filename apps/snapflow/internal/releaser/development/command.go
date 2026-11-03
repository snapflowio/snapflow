// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package development

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

type commandExecutor struct {
	stdout io.Writer
	stderr io.Writer
	stdin  io.Reader
}

func (executor commandExecutor) run(
	ctx context.Context,
	directory string,
	environment []string,
	name string,
	arguments ...string,
) error {
	command := exec.CommandContext(ctx, name, arguments...)
	command.Dir = directory
	command.Env = append(os.Environ(), environment...)
	command.Stdout = executor.stdout
	command.Stderr = executor.stderr
	command.Stdin = executor.stdin
	if err := command.Run(); err != nil {
		return fmt.Errorf("run %s: %w", strings.Join(append([]string{name}, arguments...), " "), err)
	}
	return nil
}

func (executor commandExecutor) output(
	ctx context.Context,
	directory string,
	name string,
	arguments ...string,
) (string, error) {
	command := exec.CommandContext(ctx, name, arguments...)
	command.Dir = directory
	command.Stderr = executor.stderr
	encoded, err := command.Output()
	if err != nil {
		return "", fmt.Errorf("run %s: %w", strings.Join(append([]string{name}, arguments...), " "), err)
	}
	return strings.TrimSpace(string(encoded)), nil
}
