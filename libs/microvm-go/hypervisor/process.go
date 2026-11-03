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

package hypervisor

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
)

const (
	linuxUnixSocketPathMax  = 107
	darwinUnixSocketPathMax = 103
	vmmLogDirMode           = 0o700
	vmmLogFileMode          = 0o600
	vmmLogTailBytes         = 4096
	socketReadyTimeout      = 10 * time.Second
	socketReadyPollInterval = 25 * time.Millisecond
	socketProbeTimeout      = 100 * time.Millisecond
)

type LaunchSpec struct {
	Name      string
	Arguments []string
	// ReadOnly are extra host paths the VMM reads, such as a restore source.
	ReadOnly []string
	// Sysfs gives the VMM a read-only sysfs of its network namespace.
	Sysfs      bool
	Initialize func() error
}

func ValidateUnixSocketPath(path string) error {
	limit := linuxUnixSocketPathMax
	if runtime.GOOS == "darwin" {
		limit = darwinUnixSocketPathMax
	}
	if length := len(path); length > limit {
		return fmt.Errorf("unix socket path is %d bytes; %s supports at most %d: %s (use a shorter microVM data directory)", length, runtime.GOOS, limit, path)
	}
	return nil
}

func LaunchVMM(ctx context.Context, cfg VM, spec LaunchSpec) (Process, error) {
	if err := prepareVMMLaunch(ctx, cfg, spec); err != nil {
		return Process{}, err
	}
	logFile, err := os.OpenFile(cfg.VMMLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, vmmLogFileMode)
	if err != nil {
		return Process{}, fmt.Errorf("open %s log: %w", spec.Name, err)
	}
	defer logFile.Close()

	command, err := startJailed(ctx, cfg, spec, logFile)
	if err != nil {
		return Process{}, fmt.Errorf("start %s: %w", spec.Name, err)
	}
	process, err := IdentifyProcess(command.Process.Pid)
	if err == nil {
		err = WaitForSocket(ctx, cfg.SocketPath)
	}
	if err == nil {
		err = spec.Initialize()
	}
	if err != nil {
		return Process{}, abortVMMLaunch(command, spec.Name, cfg.VMMLogPath, err)
	}
	exited := make(chan struct{})
	process.exited = exited
	go func() {
		waitErr := command.Wait()
		close(exited)
		logVMMExit(spec.Name, waitErr)
	}()
	return process, nil
}

func prepareVMMLaunch(ctx context.Context, cfg VM, spec LaunchSpec) error {
	if cfg.HypervisorBin == "" {
		return fmt.Errorf("%s binary path is required", spec.Name)
	}
	if err := ValidateUnixSocketPath(cfg.SocketPath); err != nil {
		return fmt.Errorf("validate %s API socket: %w", spec.Name, err)
	}
	if IsSocketInUse(ctx, cfg.SocketPath) {
		return fmt.Errorf("%s socket already in use: %s", spec.Name, cfg.SocketPath)
	}
	if err := os.Remove(cfg.SocketPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove stale %s socket: %w", spec.Name, err)
	}
	if err := os.MkdirAll(filepath.Dir(cfg.VMMLogPath), vmmLogDirMode); err != nil {
		return fmt.Errorf("create %s log directory: %w", spec.Name, err)
	}
	return nil
}

func abortVMMLaunch(command *exec.Cmd, name, logPath string, cause error) error {
	if signalErr := signalProcessGroup(command.Process.Pid, syscall.SIGKILL); signalErr != nil &&
		!errors.Is(signalErr, syscall.ESRCH) {
		cause = errors.Join(cause, fmt.Errorf("terminate failed %s process group: %w", name, signalErr))
	}
	if waitErr := command.Wait(); waitErr != nil {
		slog.Debug("failed VMM process reaped after termination", "name", name, "error", waitErr)
	}
	return WithLogTail(cause, logPath)
}

func logVMMExit(name string, waitErr error) {
	if waitErr == nil {
		return
	}
	var exitErr *exec.ExitError
	if errors.As(waitErr, &exitErr) {
		if status, ok := exitErr.Sys().(syscall.WaitStatus); ok && status.Signaled() &&
			(status.Signal() == syscall.SIGTERM || status.Signal() == syscall.SIGKILL) {
			slog.Debug("VMM process stopped", "name", name, "error", waitErr)
			return
		}
	}
	slog.Warn("VMM process exited with an error", "name", name, "error", waitErr)
}

func WithLogTail(err error, path string) error {
	file, readErr := os.Open(path)
	if readErr != nil {
		return err
	}
	defer file.Close()
	info, readErr := file.Stat()
	if readErr != nil {
		return err
	}
	start := max(0, info.Size()-vmmLogTailBytes)
	data, readErr := io.ReadAll(io.NewSectionReader(file, start, info.Size()-start))
	if readErr != nil || len(data) == 0 {
		return err
	}
	return fmt.Errorf("%w; vmm.log: %s", err, string(data))
}

func IsSocketInUse(ctx context.Context, path string) bool {
	probeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), socketProbeTimeout)
	defer cancel()
	return socketAcceptsConnections(probeCtx, path)
}

func socketAcceptsConnections(ctx context.Context, path string) bool {
	connection, err := (&net.Dialer{}).DialContext(ctx, "unix", path)
	if err != nil {
		return false
	}
	return connection.Close() == nil
}

func WaitForSocket(ctx context.Context, path string) error {
	readinessCtx, cancel := context.WithTimeout(ctx, socketReadyTimeout)
	defer cancel()
	ticker := time.NewTicker(socketReadyPollInterval)
	defer ticker.Stop()
	for {
		probeCtx, cancelProbe := context.WithTimeout(readinessCtx, socketProbeTimeout)
		ready := socketAcceptsConnections(probeCtx, path)
		cancelProbe()
		if ready {
			return nil
		}
		select {
		case <-readinessCtx.Done():
			return fmt.Errorf("wait for VMM API socket %s: %w", path, readinessCtx.Err())
		case <-ticker.C:
		}
	}
}
