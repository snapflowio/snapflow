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
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/godbus/dbus/v5"
	"github.com/snapflowio/computer-use/plugin"
)

const (
	configDirectoryMode     = 0o755
	snapflowDirectory       = ".snapflow"
	computerUseDirectory    = "computeruse"
	dbusLaunchCommand       = "dbus-launch"
	dbusAddressEnvironment  = "DBUS_SESSION_BUS_ADDRESS"
	dbusPIDEnvironment      = "DBUS_SESSION_BUS_PID"
	dbusAssignmentSeparator = ";"
	environmentSeparator    = "="
	dbusAssignmentParts     = 2
)

var errNotInitialized = errors.New("computer use is not initialized")

type Process struct {
	Name        string
	Command     string
	Args        []string
	Priority    int
	Env         map[string]string
	LogFile     string
	ErrFile     string
	AutoRestart bool
	Required    bool
	Ready       func() error
	cmd         *exec.Cmd
	done        chan struct{}
	cancel      context.CancelFunc
	mu          sync.Mutex
	running     bool
	generation  uint64
}

var _ plugin.ComputerUse = (*ComputerUse)(nil)

type ComputerUse struct {
	lifecycle   sync.Mutex
	initialized bool
	dbusPID     int

	processes         map[string]*Process
	requiredProcesses []string
	mu                sync.RWMutex
	configDir         string

	atspiMu   sync.Mutex
	atspiConn *dbus.Conn

	a11yStatusMu        sync.Mutex
	a11yStatusRunning   bool
	a11yStatusCheckedAt time.Time
}

func (c *ComputerUse) Initialize() (*plugin.Empty, error) {
	c.lifecycle.Lock()
	defer c.lifecycle.Unlock()
	if c.initialized {
		return new(plugin.Empty), nil
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("get home directory: %w", err)
	}
	configDir := filepath.Join(homeDir, snapflowDirectory, computerUseDirectory)
	if err := os.MkdirAll(configDir, configDirectoryMode); err != nil {
		return nil, fmt.Errorf("create computer-use config directory: %w", err)
	}
	processes, err := desktopProcesses(homeDir, configDir)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	c.configDir = configDir
	c.processes = processes
	c.requiredProcesses = requiredDesktopProcesses()
	c.mu.Unlock()
	c.initialized = true
	return new(plugin.Empty), nil
}

func (c *ComputerUse) ensureDBus() error {
	if c.dbusPID != 0 {
		return nil
	}
	output, err := exec.CommandContext(context.Background(), dbusLaunchCommand).Output()
	if err != nil {
		return fmt.Errorf("start D-Bus session: %w", err)
	}
	environment := parseDBusEnvironment(string(output))
	pid, err := strconv.Atoi(environment[dbusPIDEnvironment])
	if err != nil {
		return fmt.Errorf("read the D-Bus session PID: %w", err)
	}
	for name, value := range environment {
		if err := os.Setenv(name, value); err != nil {
			return errors.Join(fmt.Errorf("set D-Bus environment variable %s: %w", name, err), syscall.Kill(pid, syscall.SIGTERM))
		}
	}
	c.dbusPID = pid
	return nil
}

func (c *ComputerUse) stopDBus() error {
	if c.dbusPID == 0 {
		return nil
	}
	pid := c.dbusPID
	c.dbusPID = 0
	if err := syscall.Kill(pid, syscall.SIGTERM); err != nil && !errors.Is(err, syscall.ESRCH) {
		return fmt.Errorf("stop the D-Bus session: %w", err)
	}
	return nil
}

func parseDBusEnvironment(output string) map[string]string {
	environment := make(map[string]string)
	for line := range strings.Lines(output) {
		assignment := strings.SplitN(strings.TrimSpace(line), dbusAssignmentSeparator, dbusAssignmentParts)[0]
		name, value, found := strings.Cut(assignment, environmentSeparator)
		name = strings.TrimSpace(name)
		if found && (name == dbusAddressEnvironment || name == dbusPIDEnvironment) {
			environment[name] = strings.TrimSpace(value)
		}
	}
	return environment
}

func (c *ComputerUse) Start() (*plugin.Empty, error) {
	c.lifecycle.Lock()
	defer c.lifecycle.Unlock()
	if !c.initialized {
		return nil, errNotInitialized
	}
	display := environmentOrDefault(displayEnvironment, defaultDesktopDisplay)
	if err := os.Setenv(displayEnvironment, display); err != nil {
		return nil, fmt.Errorf("configure display environment: %w", err)
	}
	if err := c.ensureDBus(); err != nil {
		return nil, err
	}
	if err := c.startAllProcesses(); err != nil {
		return nil, errors.Join(err, c.stop())
	}
	c.invalidateA11yStatus()
	if failed := c.failedRequiredProcesses(); len(failed) > 0 {
		return nil, errors.Join(fmt.Errorf("required computer-use processes failed to start: %v", failed), c.stop())
	}
	return new(plugin.Empty), nil
}

func (c *ComputerUse) failedRequiredProcesses() []string {
	status := c.processStatus()
	required := c.required()
	failed := make([]string, 0, len(required))
	for _, name := range required {
		if processStatus, ok := status[name]; !ok || !processStatus.Running {
			failed = append(failed, name)
		}
	}
	return failed
}

func (c *ComputerUse) Stop() (*plugin.Empty, error) {
	c.lifecycle.Lock()
	defer c.lifecycle.Unlock()
	return new(plugin.Empty), c.stop()
}
