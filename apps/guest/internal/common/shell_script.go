// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package common

import (
	"bytes"
	"context"
	"errors"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"github.com/snapflowio/guest/internal/childreap"
)

const failedExitCode = -1

type ShellScript struct {
	Script  string
	Dir     string
	Envs    map[string]string
	Timeout time.Duration
}

type ShellResult struct {
	Output   []byte
	ExitCode int
	TimedOut bool
}

func RunShellScript(ctx context.Context, reaper *childreap.Reaper, script ShellScript) (ShellResult, error) {
	if script.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, script.Timeout)
		defer cancel()
	}
	var output bytes.Buffer
	cmd := exec.CommandContext(ctx, GetShell())
	cmd.Stdin = strings.NewReader(script.Script)
	cmd.Dir = script.Dir
	cmd.Stdout = &output
	cmd.Stderr = &output
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
	cmd.WaitDelay = childreap.PipeDrainTimeout
	ApplyEnvs(cmd, script.Envs)
	if err := cmd.Start(); err != nil {
		return ShellResult{}, err
	}
	exitCode, err := reaper.Wait(cmd)
	if err != nil {
		exitCode = failedExitCode
	}
	return ShellResult{
		Output:   output.Bytes(),
		ExitCode: exitCode,
		TimedOut: errors.Is(ctx.Err(), context.DeadlineExceeded),
	}, nil
}
