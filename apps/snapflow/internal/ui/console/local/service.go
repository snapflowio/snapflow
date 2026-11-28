// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package local

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"

	"github.com/snapflowio/snapflow/internal/foundation/config"
	"github.com/snapflowio/snapflow/internal/foundation/system"
	"github.com/snapflowio/snapflow/internal/foundation/systemd"
)

const (
	activeState          = "active"
	enabledUnitFileState = "enabled"
	journalErrorPriority = "err"
	journalNoEntries     = "-- No entries --"
)

type CommandRunner interface {
	Run(context.Context, io.Writer, io.Writer, string, ...string) error
	Output(context.Context, string, ...string) (string, error)
}

type ExecCommandRunner struct{}

func (ExecCommandRunner) Run(ctx context.Context, stdout, stderr io.Writer, name string, arguments ...string) error {
	command := exec.CommandContext(ctx, name, arguments...)
	command.Stdout = stdout
	command.Stderr = stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("run %s: %w", name, err)
	}
	return nil
}

func (ExecCommandRunner) Output(ctx context.Context, name string, arguments ...string) (string, error) {
	output, err := exec.CommandContext(ctx, name, arguments...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("run %s: %s: %w", name, strings.TrimSpace(string(output)), err)
	}
	return strings.TrimSpace(string(output)), nil
}

type ServiceManager struct {
	commands CommandRunner
	systemd  systemd.Manager
}

type ServiceStatus struct {
	Active        bool   `json:"active"`
	Enabled       bool   `json:"enabled"`
	ActiveState   string `json:"activeState"`
	SubState      string `json:"subState"`
	UnitFileState string `json:"unitFileState"`
}

type ServiceManagerConfig struct {
	Commands CommandRunner
	Systemd  systemd.Manager
	Profile  config.ProfileName
}

func NewServiceManager(cfg ServiceManagerConfig) (*ServiceManager, error) {
	if cfg.Commands == nil || cfg.Systemd == nil {
		return nil, errors.New("the system service command runner and systemd manager are required")
	}
	if cfg.Profile != config.Production {
		return nil, fmt.Errorf("system service does not support Snapflow profile %q", cfg.Profile)
	}
	return &ServiceManager{commands: cfg.Commands, systemd: cfg.Systemd}, nil
}

func (manager *ServiceManager) InstallSystemFiles(ctx context.Context, profile config.Profile, log io.Writer) error {
	return SyncActiveSystemFiles(ctx, profile, manager.commands, log)
}

func (manager *ServiceManager) EnableAndStart(ctx context.Context) error {
	return manager.enableNow(ctx, system.ServiceUnit)
}

func (manager *ServiceManager) Start(ctx context.Context) error {
	return manager.systemd.Start(ctx, system.ServiceUnit)
}

func (manager *ServiceManager) EnableUpdates(ctx context.Context) error {
	return manager.enableNow(ctx, system.UpdateTimerUnit)
}

func (manager *ServiceManager) Stop(ctx context.Context) error {
	return manager.systemd.Stop(ctx, system.ServiceUnit)
}

func (manager *ServiceManager) Disable(ctx context.Context) error {
	for _, unit := range []string{system.UpdateTimerUnit, system.ServiceUnit} {
		if err := manager.systemd.Disable(ctx, unit); err != nil {
			return err
		}
		if err := manager.systemd.Stop(ctx, unit); err != nil {
			return err
		}
	}
	return manager.systemd.Stop(ctx, system.VMSliceUnit)
}

func (manager *ServiceManager) enableNow(ctx context.Context, unit string) error {
	if err := manager.systemd.Enable(ctx, unit); err != nil {
		return err
	}
	return manager.systemd.Start(ctx, unit)
}

func (manager *ServiceManager) Status(ctx context.Context) (ServiceStatus, error) {
	state, err := manager.systemd.State(ctx, system.ServiceUnit)
	if err != nil {
		return ServiceStatus{}, fmt.Errorf("read the Snapflow service state: %w", err)
	}
	return ServiceStatus{
		Active: state.ActiveState == activeState, Enabled: state.UnitFileState == enabledUnitFileState,
		ActiveState: state.ActiveState, SubState: state.SubState, UnitFileState: state.UnitFileState,
	}, nil
}

func (manager *ServiceManager) RecentErrors(ctx context.Context, limit int) ([]string, error) {
	output, err := manager.commands.Output(ctx, "journalctl", "--unit", system.ServiceUnit, "--no-pager",
		"--priority", journalErrorPriority, "--lines", strconv.Itoa(limit), "--output", "cat")
	if err != nil {
		return nil, fmt.Errorf("read Snapflow service errors: %w", err)
	}
	entries := []string{}
	for _, line := range strings.Split(output, "\n") {
		if trimmed := strings.TrimSpace(line); trimmed != "" && trimmed != journalNoEntries {
			entries = append(entries, trimmed)
		}
	}
	return entries, nil
}
