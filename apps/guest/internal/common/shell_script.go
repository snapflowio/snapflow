// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package common

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"syscall"
	"time"

	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/sandbox"
)

const (
	failedExitCode       = -1
	scriptDescriptorPath = "/proc/self/fd/3"
)

type ShellScript struct {
	Script  string
	Dir     string
	Envs    map[string]string
	Timeout time.Duration
	User    sandbox.User
}

type ShellResult struct {
	Output   []byte
	Stdout   []byte
	Stderr   []byte
	ExitCode int
	TimedOut bool
}

func RunShellScript(ctx context.Context, reaper *childreap.Reaper, script ShellScript) (ShellResult, error) {
	if script.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, script.Timeout)
		defer cancel()
	}
	scriptReader, scriptWriter, err := os.Pipe()
	if err != nil {
		return ShellResult{}, fmt.Errorf("open the script pipe: %w", err)
	}
	if err := script.User.OwnFile(scriptReader); err != nil {
		return ShellResult{}, errors.Join(err, scriptReader.Close(), scriptWriter.Close())
	}
	output := &capturedOutput{}
	cmd := exec.CommandContext(ctx, GetScriptShell(), scriptDescriptorPath)
	cmd.ExtraFiles = []*os.File{scriptReader}
	cmd.Dir = script.Dir
	cmd.Stdout = output.writer(&output.stdout)
	cmd.Stderr = output.writer(&output.stderr)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
	cmd.WaitDelay = childreap.PipeDrainTimeout
	script.User.Configure(cmd)
	ApplyEnvs(cmd, script.Envs)
	startErr := cmd.Start()
	closeErr := scriptReader.Close()
	if startErr != nil {
		return ShellResult{}, errors.Join(startErr, closeErr, scriptWriter.Close())
	}
	written := make(chan error, 1)
	go func() { written <- writeScript(scriptWriter, script.Script) }()
	exitCode, waitErr := reaper.Wait(cmd)
	if waitErr != nil {
		exitCode = failedExitCode
	}
	if err := errors.Join(closeErr, <-written); err != nil {
		return ShellResult{}, err
	}
	return ShellResult{
		Output:   output.combined.Bytes(),
		Stdout:   output.stdout.Bytes(),
		Stderr:   output.stderr.Bytes(),
		ExitCode: exitCode,
		TimedOut: errors.Is(ctx.Err(), context.DeadlineExceeded),
	}, nil
}

func writeScript(writer *os.File, script string) error {
	_, err := io.WriteString(writer, script)
	if errors.Is(err, syscall.EPIPE) {
		err = nil
	}
	if err != nil {
		err = fmt.Errorf("send the script to the shell: %w", err)
	}
	return errors.Join(err, writer.Close())
}
