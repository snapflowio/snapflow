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
	"os/signal"
	"syscall"
	"time"

	"github.com/snapflowio/microvm-go/internal/exitinfo"
)

func runConfiguredWorkload(ctx context.Context, cfg *Config, workloadEnv []string, children *childReaper, bootStarted, phaseStarted time.Time) (int, bool, error) {
	workload, err := startConfiguredWorkload(ctx, cfg, workloadEnv)
	if err != nil {
		logBootMilestone(bootStarted, phaseStarted, bootPhaseWorkload, err)
		return 0, false, err
	}
	if err := acknowledgeWorkloadStarted(cfg); err != nil {
		logBootMilestone(bootStarted, phaseStarted, bootPhaseWorkload, err)
		return 0, workload != nil, errors.Join(err, terminateCommand(children, workload, "workload"))
	}
	logBootMilestone(bootStarted, phaseStarted, bootPhaseWorkload, nil)
	return finishConfiguredWorkload(ctx, children, workload)
}

func startConfiguredWorkload(ctx context.Context, cfg *Config, workloadEnv []string) (*exec.Cmd, error) {
	args := commandArgs(cfg)
	if len(args) == 0 {
		return nil, nil
	}
	Log("starting workload: %v", args)
	cmd := exec.CommandContext(context.WithoutCancel(ctx), args[0], args[1:]...)
	cmd.Dir = cfg.Workdir
	identity, err := resolveWorkloadIdentity(cfg.OSUser)
	if err != nil {
		return nil, fmt.Errorf("resolve workload user: %w", err)
	}
	cmd.Env = environmentWithHome(workloadEnv, identity.home)
	cmd.SysProcAttr = workloadProcessAttributes(identity)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start workload: %w", err)
	}
	return cmd, nil
}

func finishConfiguredWorkload(ctx context.Context, children *childReaper, workload *exec.Cmd) (int, bool, error) {
	if workload == nil {
		Log("no entrypoint configured; keeping guest components online")
		return 0, false, waitForShutdown(ctx)
	}
	exitCode, err := waitForWorkload(ctx, children, workload)
	return exitCode, true, err
}

func terminateCommand(children *childReaper, command *exec.Cmd, description string) error {
	if command == nil || command.Process == nil {
		return nil
	}
	if err := signalProcessGroup(command.Process.Pid, syscall.SIGTERM); err != nil && !errors.Is(err, os.ErrProcessDone) && !errors.Is(err, syscall.ESRCH) {
		return fmt.Errorf("terminate %s: %w", description, err)
	}
	waitResult := make(chan error, 1)
	go func() {
		exitCode, err := children.wait(command)
		if err != nil {
			waitResult <- err
			return
		}
		Log("%s exited code=%d", description, exitCode)
		waitResult <- nil
	}()
	timer := time.NewTimer(processTerminationTimeout)
	defer timer.Stop()
	select {
	case err := <-waitResult:
		if err != nil {
			return fmt.Errorf("wait for %s shutdown: %w", description, err)
		}
		return nil
	case <-timer.C:
		if err := signalProcessGroup(command.Process.Pid, syscall.SIGKILL); err != nil && !errors.Is(err, os.ErrProcessDone) && !errors.Is(err, syscall.ESRCH) {
			return fmt.Errorf("kill %s after shutdown timeout: %w", description, err)
		}
		if err := <-waitResult; err != nil {
			return fmt.Errorf("wait for forced %s shutdown: %w", description, err)
		}
		return fmt.Errorf("%s required forced termination", description)
	}
}

func waitForWorkload(ctx context.Context, children *childReaper, cmd *exec.Cmd) (int, error) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGHUP, syscall.SIGQUIT, syscall.SIGINT)
	defer signal.Stop(sigCh)
	waitResult := make(chan commandWaitResult, 1)
	go func() {
		exitCode, err := children.wait(cmd)
		waitResult <- commandWaitResult{exitCode: exitCode, err: err}
	}()
	for {
		select {
		case result := <-waitResult:
			if result.err != nil {
				return result.exitCode, fmt.Errorf("wait for workload: %w", result.err)
			}
			Log("workload exited code=%d", result.exitCode)
			return result.exitCode, nil
		case sig := <-sigCh:
			systemSignal, ok := sig.(syscall.Signal)
			if !ok {
				Log("cannot forward unsupported workload signal %v", sig)
				continue
			}
			if err := signalProcessGroup(cmd.Process.Pid, systemSignal); err != nil && !errors.Is(err, os.ErrProcessDone) && !errors.Is(err, syscall.ESRCH) {
				Log("forward workload signal %s: %v", sig, err)
			}
		case <-ctx.Done():
			return stopWorkloadAfterCancellation(ctx, cmd, waitResult)
		}
	}
}

type commandWaitResult struct {
	exitCode int
	err      error
}

func stopWorkloadAfterCancellation(ctx context.Context, command *exec.Cmd, waitResult <-chan commandWaitResult) (int, error) {
	cause := context.Cause(ctx)
	if err := signalProcessGroup(command.Process.Pid, syscall.SIGTERM); err != nil && !errors.Is(err, os.ErrProcessDone) && !errors.Is(err, syscall.ESRCH) {
		return 0, errors.Join(cause, fmt.Errorf("terminate workload after sandbox control failure: %w", err))
	}
	timer := time.NewTimer(processTerminationTimeout)
	defer timer.Stop()
	select {
	case result := <-waitResult:
		return result.exitCode, errors.Join(cause, result.err)
	case <-timer.C:
		if err := signalProcessGroup(command.Process.Pid, syscall.SIGKILL); err != nil && !errors.Is(err, os.ErrProcessDone) && !errors.Is(err, syscall.ESRCH) {
			return 0, errors.Join(cause, fmt.Errorf("kill workload after sandbox control failure: %w", err))
		}
		result := <-waitResult
		return result.exitCode, errors.Join(cause, result.err, errors.New("workload required forced termination"))
	}
}

func reportWorkloadExit(code int, generationID string) {
	message := describeExitCode(code)
	if code == 137 && checkOOMKill() {
		message += " - OOM"
	}
	Log("%s", exitinfo.Format(exitinfo.Record{Code: code, GenerationID: generationID, Message: message}))
}
