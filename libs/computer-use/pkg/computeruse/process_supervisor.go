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

package computeruse

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"slices"
	"strings"
	"syscall"
	"time"

	"github.com/snapflowio/computer-use/plugin"
)

const (
	processOutputMode = 0o644
	statusActive      = "active"
	statusPartial     = "partial"
	statusInactive    = "inactive"
)

var errProcessNotRunning = errors.New("process is not running")

func (c *ComputerUse) startAllProcesses() error {
	for _, process := range c.getProcessesByPriority() {
		go c.supervise(process)
		if process.Required {
			if err := waitForProcessReady(process, computerProcessReadyTimeout); err != nil {
				return fmt.Errorf("start %s: %w", process.Name, err)
			}
		}
	}
	return nil
}

func waitForProcessReady(process *Process, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		lastErr := processReadiness(process)
		if lastErr == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("readiness timed out after %s: %w", timeout, lastErr)
		}
		time.Sleep(computerProcessPollInterval)
	}
}

func processReadiness(process *Process) error {
	if !getProcessStatus(process).Running {
		return errProcessNotRunning
	}
	if process.Ready == nil {
		return nil
	}
	return process.Ready()
}

func (c *ComputerUse) getProcessesByPriority() []*Process {
	c.mu.RLock()
	defer c.mu.RUnlock()
	processes := make([]*Process, 0, len(c.processes))
	for _, process := range c.processes {
		processes = append(processes, process)
	}
	slices.SortFunc(processes, func(left, right *Process) int {
		return cmp.Compare(left.Priority, right.Priority)
	})
	return processes
}

func (c *ComputerUse) supervise(process *Process) {
	ctx, generation, done, started := beginGeneration(process)
	if !started {
		return
	}
	defer endGeneration(process, generation, done)
	for {
		runProcessOnce(ctx, process, generation)
		if !processShouldRestart(process, generation) {
			return
		}
		slog.Warn("Restarting computer-use process", "process", process.Name, "delay", computerProcessRestartDelay)
		if !waitForProcessRestart(ctx) {
			return
		}
	}
}

func beginGeneration(process *Process) (context.Context, uint64, chan struct{}, bool) {
	process.mu.Lock()
	defer process.mu.Unlock()
	if process.running {
		return nil, 0, nil, false
	}
	ctx, cancel := context.WithCancel(context.Background())
	process.running = true
	process.generation++
	process.done = make(chan struct{})
	process.cancel = cancel
	return ctx, process.generation, process.done, true
}

func endGeneration(process *Process, generation uint64, done chan struct{}) {
	process.mu.Lock()
	if process.generation == generation {
		process.running = false
		process.cmd = nil
		process.done = nil
		process.cancel = nil
	}
	process.mu.Unlock()
	close(done)
}

func runProcessOnce(ctx context.Context, process *Process, generation uint64) {
	slog.Info("Starting computer-use process", "process", process.Name)
	command := exec.CommandContext(ctx, process.Command, process.Args...)
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	command.Env = processEnvironment(process.Env)
	command.Cancel = func() error { return signalProcessGroup(command, syscall.SIGTERM) }
	outputs := attachProcessOutput(command, process)
	defer closeProcessOutput(process.Name, outputs...)
	if err := command.Start(); err != nil {
		slog.Error("Failed to start computer-use process", "process", process.Name, "error", err)
		return
	}
	if !setProcessCommand(process, generation, command) {
		if err := errors.Join(signalProcessGroup(command, syscall.SIGKILL), command.Wait()); err != nil {
			slog.Debug("Canceled computer-use process exited", "process", process.Name, "error", err)
		}
		return
	}
	slog.Info("Computer-use process started", "process", process.Name, "pid", command.Process.Pid)
	waitErr := command.Wait()
	clearProcessCommand(process, generation, command)
	slog.Info("Computer-use process exited", "process", process.Name, "error", waitErr)
}

func attachProcessOutput(command *exec.Cmd, process *Process) []*os.File {
	var files []*os.File
	if logFile, err := openProcessOutput(process.LogFile); err != nil {
		slog.Error("Failed to open process log", "process", process.Name, "error", err)
	} else if logFile != nil {
		command.Stdout = logFile
		files = append(files, logFile)
	}
	if errorFile, err := openProcessOutput(process.ErrFile); err != nil {
		slog.Error("Failed to open process error log", "process", process.Name, "error", err)
	} else if errorFile != nil {
		command.Stderr = errorFile
		files = append(files, errorFile)
	}
	return files
}

func processEnvironment(values map[string]string) []string {
	environmentByName := make(map[string]string, len(os.Environ())+len(values))
	for _, entry := range os.Environ() {
		if name, _, found := strings.Cut(entry, environmentSeparator); found && name != "" {
			environmentByName[name] = entry
		}
	}
	for key, value := range values {
		environmentByName[key] = key + environmentSeparator + value
	}
	environment := make([]string, 0, len(environmentByName))
	for _, entry := range environmentByName {
		environment = append(environment, entry)
	}
	slices.Sort(environment)
	return environment
}

func openProcessOutput(path string) (*os.File, error) {
	if path == "" {
		return nil, nil
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, processOutputMode)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	return file, nil
}

func waitForProcessRestart(ctx context.Context) bool {
	timer := time.NewTimer(computerProcessRestartDelay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}

func setProcessCommand(process *Process, generation uint64, command *exec.Cmd) bool {
	process.mu.Lock()
	defer process.mu.Unlock()
	if !process.running || process.generation != generation {
		return false
	}
	process.cmd = command
	return true
}

func clearProcessCommand(process *Process, generation uint64, command *exec.Cmd) {
	process.mu.Lock()
	defer process.mu.Unlock()
	if process.generation == generation && process.cmd == command {
		process.cmd = nil
	}
}

func processShouldRestart(process *Process, generation uint64) bool {
	process.mu.Lock()
	defer process.mu.Unlock()
	return process.running && process.generation == generation && process.AutoRestart
}

func closeProcessOutput(processName string, files ...*os.File) {
	for _, file := range files {
		if err := file.Close(); err != nil {
			slog.Error("Failed to close process output", "process", processName, "path", file.Name(), "error", err)
		}
	}
}

func (c *ComputerUse) stop() error {
	slog.Info("Stopping computer-use processes")
	processes := c.getProcessesByPriority()
	var stopErr error
	for index := len(processes) - 1; index >= 0; index-- {
		stopErr = errors.Join(stopErr, c.stopProcess(processes[index]))
	}
	c.atspiMu.Lock()
	if c.atspiConn != nil {
		if err := c.atspiConn.Close(); err != nil {
			stopErr = errors.Join(stopErr, fmt.Errorf("close accessibility bus: %w", err))
		}
		c.atspiConn = nil
	}
	c.atspiMu.Unlock()
	c.setA11yStatus(false)
	return errors.Join(stopErr, c.stopDBus())
}

func (c *ComputerUse) stopProcess(process *Process) error {
	process.mu.Lock()
	if !process.running {
		process.mu.Unlock()
		return nil
	}
	process.running = false
	process.generation++
	command, done, cancel := process.cmd, process.done, process.cancel
	process.cmd = nil
	process.done = nil
	process.cancel = nil
	process.mu.Unlock()

	slog.Info("Stopping computer-use process", "process", process.Name)
	cancel()
	gracefulTimer := time.NewTimer(computerProcessStopTimeout)
	defer gracefulTimer.Stop()
	select {
	case <-done:
		return nil
	case <-gracefulTimer.C:
	}
	killErr := signalProcessGroup(command, syscall.SIGKILL)
	killTimer := time.NewTimer(computerProcessKillTimeout)
	defer killTimer.Stop()
	select {
	case <-done:
		return killErr
	case <-killTimer.C:
		return errors.Join(killErr, fmt.Errorf("force-stop %s timed out after %s", process.Name, computerProcessKillTimeout))
	}
}

func signalProcessGroup(command *exec.Cmd, signal syscall.Signal) error {
	if command == nil || command.Process == nil {
		return nil
	}
	if err := syscall.Kill(-command.Process.Pid, signal); err != nil && !errors.Is(err, syscall.ESRCH) {
		return err
	}
	return nil
}

func (c *ComputerUse) required() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.requiredProcesses
}

func (c *ComputerUse) processStatus() map[string]plugin.ProcessStatus {
	c.mu.RLock()
	processes := make(map[string]*Process, len(c.processes))
	for name, process := range c.processes {
		processes[name] = process
	}
	c.mu.RUnlock()
	status := make(map[string]plugin.ProcessStatus, len(processes)+1)
	for name, process := range processes {
		status[name] = getProcessStatus(process)
	}
	status[accessibilityBusName] = plugin.ProcessStatus{Running: c.cachedA11yAvailable()}
	return status
}

func (c *ComputerUse) GetProcessStatus() (map[string]plugin.ProcessStatus, error) {
	return c.processStatus(), nil
}

func getProcessStatus(process *Process) plugin.ProcessStatus {
	process.mu.Lock()
	defer process.mu.Unlock()
	status := plugin.ProcessStatus{Priority: process.Priority, AutoRestart: process.AutoRestart}
	if process.cmd != nil && process.cmd.Process != nil {
		if err := process.cmd.Process.Signal(syscall.Signal(0)); err == nil {
			pid := process.cmd.Process.Pid
			status.Running = true
			status.Pid = &pid
		}
	}
	return status
}

func (c *ComputerUse) lookupProcess(name string) (*Process, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	process, exists := c.processes[name]
	if !exists {
		return nil, fmt.Errorf("process %s not found", name)
	}
	return process, nil
}

func (c *ComputerUse) IsProcessRunning(request *plugin.ProcessRequest) (bool, error) {
	if request.ProcessName == accessibilityBusName {
		return c.cachedA11yAvailable(), nil
	}
	process, err := c.lookupProcess(request.ProcessName)
	if err != nil {
		return false, err
	}
	return getProcessStatus(process).Running, nil
}

func (c *ComputerUse) RestartProcess(request *plugin.ProcessRequest) (*plugin.Empty, error) {
	process, err := c.lookupProcess(request.ProcessName)
	if err != nil {
		return nil, err
	}
	if err := c.stopProcess(process); err != nil {
		return nil, err
	}
	go c.supervise(process)
	if process.Required {
		if err := waitForProcessReady(process, computerProcessReadyTimeout); err != nil {
			return nil, fmt.Errorf("restart %s: %w", process.Name, err)
		}
	}
	return new(plugin.Empty), nil
}

func (c *ComputerUse) GetProcessLogs(request *plugin.ProcessRequest) (string, error) {
	return c.readProcessOutput(request.ProcessName, false)
}

func (c *ComputerUse) GetProcessErrors(request *plugin.ProcessRequest) (string, error) {
	return c.readProcessOutput(request.ProcessName, true)
}

func (c *ComputerUse) readProcessOutput(name string, stderr bool) (string, error) {
	process, err := c.lookupProcess(name)
	if err != nil {
		return "", err
	}
	path := process.LogFile
	if stderr {
		path = process.ErrFile
	}
	if path == "" {
		return "", fmt.Errorf("no output file configured for process %s", name)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read output for process %s: %w", name, err)
	}
	return string(content), nil
}

func (c *ComputerUse) GetStatus() (*plugin.ComputerUseStatusResponse, error) {
	processStatus := c.processStatus()
	allRunning := true
	anyRunning := false
	for _, name := range c.required() {
		if status, exists := processStatus[name]; !exists || !status.Running {
			allRunning = false
		}
	}
	for _, status := range processStatus {
		anyRunning = anyRunning || status.Running
	}
	switch {
	case allRunning:
		return &plugin.ComputerUseStatusResponse{Status: statusActive}, nil
	case anyRunning:
		return &plugin.ComputerUseStatusResponse{Status: statusPartial}, nil
	default:
		return &plugin.ComputerUseStatusResponse{Status: statusInactive}, nil
	}
}
