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
	"log/slog"
	"os"
	"os/exec"
	"syscall"

	"github.com/creack/pty"
	"github.com/snapflowio/guest/internal/childreap"
)

type TTYSize struct {
	Height uint16
	Width  uint16
}

type SpawnTTYOptions struct {
	Dir    string
	StdIn  io.Reader
	StdOut io.Writer
	Term   string
	Env    []string
	SizeCh <-chan TTYSize
}

func SpawnTTY(ctx context.Context, reaper *childreap.Reaper, opts SpawnTTYOptions) (int, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	shell := GetShell()
	cmd := exec.CommandContext(ctx, shell)
	cmd.Dir = opts.Dir
	cmd.Env = append(cmd.Env, "TERM="+opts.Term)
	cmd.Env = append(cmd.Env, os.Environ()...)
	cmd.Env = append(cmd.Env, "SHELL="+shell)
	cmd.Env = append(cmd.Env, opts.Env...)

	terminal, err := pty.Start(cmd)
	if err != nil {
		return -1, err
	}
	go resizeTTY(ctx, terminal, opts.SizeCh)
	go func() {
		if bytesCopied, copyErr := io.Copy(terminal, opts.StdIn); copyErr != nil {
			slog.Debug("Terminal input stream closed", "bytesCopied", bytesCopied, "error", copyErr)
		}
	}()

	var outputErr error
	if bytesCopied, copyErr := io.Copy(opts.StdOut, terminal); copyErr != nil && !errors.Is(copyErr, syscall.EIO) {
		outputErr = fmt.Errorf("copy terminal output after %d bytes: %w", bytesCopied, copyErr)
	}
	cancel()
	var closeErr error
	if err := terminal.Close(); err != nil {
		closeErr = fmt.Errorf("close terminal: %w", err)
	}
	exitCode, reapErr := reaper.Reap(cmd)
	return exitCode, errors.Join(outputErr, closeErr, reapErr)
}

func resizeTTY(ctx context.Context, terminal *os.File, sizes <-chan TTYSize) {
	for {
		select {
		case <-ctx.Done():
			return
		case size, open := <-sizes:
			if !open {
				return
			}
			if err := pty.Setsize(terminal, &pty.Winsize{Rows: size.Height, Cols: size.Width}); err != nil {
				slog.Debug("Unable to resize terminal", "error", err)
			}
		}
	}
}
