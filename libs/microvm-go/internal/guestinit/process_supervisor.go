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

package guestinit

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

const (
	processRestartMinimum       = time.Second
	processRestartMaximum       = 30 * time.Second
	processStableUptime         = 30 * time.Second
	processTerminationTimeout   = 10 * time.Second
	processRestartBackoffFactor = 2
)

type processSpec struct {
	name         string
	path         string
	args         []string
	env          []string
	afterRestart func(context.Context) error
}

type processSupervisor struct {
	spec     processSpec
	children *childReaper
	cancel   context.CancelFunc
	done     chan struct{}

	mu      sync.Mutex
	command *exec.Cmd
}

func startProcessSupervisor(spec processSpec, children *childReaper) (*processSupervisor, error) {
	if spec.name == "" || spec.path == "" {
		return nil, fmt.Errorf("supervised process name and path are required")
	}
	ctx, cancel := context.WithCancel(context.Background())
	supervisor := &processSupervisor{spec: spec, children: children, cancel: cancel, done: make(chan struct{})}
	command, err := supervisor.start(ctx)
	if err != nil {
		cancel()
		return nil, err
	}
	supervisor.command = command
	go supervisor.run(ctx, command)
	return supervisor, nil
}

func (supervisor *processSupervisor) start(ctx context.Context) (*exec.Cmd, error) {
	command := exec.CommandContext(context.WithoutCancel(ctx), supervisor.spec.path, supervisor.spec.args...)
	command.Env = supervisor.spec.env
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := command.Start(); err != nil {
		return nil, fmt.Errorf("start %s: %w", supervisor.spec.name, err)
	}
	Log("%s started pid=%d", supervisor.spec.name, command.Process.Pid)
	return command, nil
}

func (supervisor *processSupervisor) run(ctx context.Context, command *exec.Cmd) {
	defer close(supervisor.done)
	retryDelay := processRestartMinimum
	for {
		startedAt := time.Now()
		exitCode, err := supervisor.children.wait(command)
		supervisor.release(command)
		if ctx.Err() != nil {
			return
		}
		Log("%s exited unexpectedly code=%d: %v", supervisor.spec.name, exitCode, err)
		if time.Since(startedAt) >= processStableUptime {
			retryDelay = processRestartMinimum
		}
		var restarted bool
		command, retryDelay, restarted = supervisor.restart(ctx, retryDelay)
		if !restarted {
			return
		}
	}
}

func (supervisor *processSupervisor) release(command *exec.Cmd) {
	supervisor.mu.Lock()
	defer supervisor.mu.Unlock()
	if supervisor.command == command {
		supervisor.command = nil
	}
}

func (supervisor *processSupervisor) restart(ctx context.Context, retryDelay time.Duration) (*exec.Cmd, time.Duration, bool) {
	for {
		if !waitForProcessRestart(ctx, retryDelay) {
			return nil, retryDelay, false
		}
		retryDelay = nextProcessRestartDelay(retryDelay)
		command, err := supervisor.start(ctx)
		if err == nil {
			supervisor.adopt(ctx, command)
			return command, retryDelay, true
		}
		Log("%s restart failed; retrying in %s: %v", supervisor.spec.name, retryDelay, err)
	}
}

func (supervisor *processSupervisor) adopt(ctx context.Context, command *exec.Cmd) {
	supervisor.mu.Lock()
	supervisor.command = command
	supervisor.mu.Unlock()
	if supervisor.spec.afterRestart == nil {
		return
	}
	restartErr := supervisor.spec.afterRestart(ctx)
	if restartErr == nil {
		return
	}
	Log("%s restart configuration failed; restarting again: %v", supervisor.spec.name, restartErr)
	if err := signalProcessGroup(command.Process.Pid, syscall.SIGTERM); err != nil && !errors.Is(err, syscall.ESRCH) {
		Log("%s could not be stopped after a failed restart configuration: %v", supervisor.spec.name, err)
	}
}

func (supervisor *processSupervisor) Stop() error {
	return supervisor.stop(processTerminationTimeout)
}

func (supervisor *processSupervisor) stop(timeout time.Duration) error {
	supervisor.cancel()
	supervisor.mu.Lock()
	command := supervisor.command
	supervisor.mu.Unlock()

	var terminationErr error
	if command != nil && command.Process != nil {
		if err := signalProcessGroup(command.Process.Pid, syscall.SIGTERM); err != nil && !errors.Is(err, os.ErrProcessDone) && !errors.Is(err, syscall.ESRCH) {
			terminationErr = fmt.Errorf("terminate %s: %w", supervisor.spec.name, err)
		}
	}

	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-supervisor.done:
		return terminationErr
	case <-timer.C:
		if command == nil || command.Process == nil {
			return fmt.Errorf("wait for %s shutdown: timed out", supervisor.spec.name)
		}
		if err := signalProcessGroup(command.Process.Pid, syscall.SIGKILL); err != nil && !errors.Is(err, os.ErrProcessDone) && !errors.Is(err, syscall.ESRCH) {
			return errors.Join(terminationErr, fmt.Errorf("kill %s after shutdown timeout: %w", supervisor.spec.name, err))
		}
		<-supervisor.done
		return errors.Join(terminationErr, fmt.Errorf("%s required forced termination", supervisor.spec.name))
	}
}

func signalProcessGroup(pid int, signal syscall.Signal) error {
	if pid <= 0 {
		return fmt.Errorf("invalid process id %d", pid)
	}
	return syscall.Kill(-pid, signal)
}

func waitForProcessRestart(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func nextProcessRestartDelay(current time.Duration) time.Duration {
	return min(current*processRestartBackoffFactor, processRestartMaximum)
}
