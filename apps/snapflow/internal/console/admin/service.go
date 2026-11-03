// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package admin

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"

	"github.com/snapflowio/snapflow/internal/config"
)

const (
	serviceUnit          = "snapflow.service"
	updateTimerUnit      = "snapflow-update.timer"
	logLines             = "200"
	journalErrorPriority = "err"
	journalNoEntries     = "-- No entries --"
	journalJSONOutput    = "json"
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
	Profile  config.ProfileName
}

func NewServiceManager(cfg ServiceManagerConfig) (*ServiceManager, error) {
	if cfg.Commands == nil {
		return nil, errors.New("system service command machine is required")
	}
	if cfg.Profile != config.Production {
		return nil, fmt.Errorf("system service does not support Snapflow profile %q", cfg.Profile)
	}
	return &ServiceManager{commands: cfg.Commands}, nil
}

func (manager *ServiceManager) InstallSystemFiles(ctx context.Context, profile config.Profile, log io.Writer) error {
	return SyncActiveSystemFiles(ctx, profile, manager.commands, log)
}

func (manager *ServiceManager) EnableAndStart(ctx context.Context, stdout, stderr io.Writer) error {
	if err := manager.commands.Run(ctx, stdout, stderr, "systemctl", "daemon-reload"); err != nil {
		return err
	}
	return manager.commands.Run(ctx, stdout, stderr, "systemctl", "enable", "--now", serviceUnit)
}

func (manager *ServiceManager) Start(ctx context.Context, stdout, stderr io.Writer) error {
	return manager.commands.Run(ctx, stdout, stderr, "systemctl", "start", serviceUnit)
}

func (manager *ServiceManager) EnableUpdates(ctx context.Context, stdout, stderr io.Writer) error {
	return manager.commands.Run(ctx, stdout, stderr, "systemctl", "enable", "--now", updateTimerUnit)
}

func (manager *ServiceManager) Stop(ctx context.Context, stdout, stderr io.Writer) error {
	return manager.commands.Run(ctx, stdout, stderr, "systemctl", "stop", serviceUnit)
}

func (manager *ServiceManager) Disable(ctx context.Context, stdout, stderr io.Writer) error {
	if err := manager.commands.Run(ctx, stdout, stderr, "systemctl", "disable", "--now", updateTimerUnit); err != nil {
		return err
	}
	return manager.commands.Run(ctx, stdout, stderr, "systemctl", "disable", "--now", serviceUnit)
}

func (manager *ServiceManager) Status(ctx context.Context) (ServiceStatus, error) {
	output, err := manager.commands.Output(ctx, "systemctl", "show", serviceUnit,
		"--property=ActiveState,SubState,UnitFileState", "--no-pager")
	if err != nil {
		return ServiceStatus{}, err
	}
	properties := make(map[string]string)
	for _, line := range strings.Split(output, "\n") {
		name, value, found := strings.Cut(line, "=")
		if found {
			properties[name] = value
		}
	}
	status := ServiceStatus{
		ActiveState: properties["ActiveState"], SubState: properties["SubState"],
		UnitFileState: properties["UnitFileState"],
	}
	status.Active = status.ActiveState == "active"
	status.Enabled = status.UnitFileState == "enabled"
	if status.ActiveState == "" || status.SubState == "" || status.UnitFileState == "" {
		return ServiceStatus{}, errors.New("systemd returned incomplete Snapflow service state")
	}
	return status, nil
}

type LogOptions struct {
	Follow bool
	JSON   bool
}

func (manager *ServiceManager) Logs(ctx context.Context, stdout, stderr io.Writer, options LogOptions) error {
	arguments := []string{"--unit", serviceUnit, "--no-pager", "--lines", logLines}
	if options.Follow {
		arguments = append(arguments, "--follow")
	}
	if options.JSON {
		arguments = append(arguments, "--output", journalJSONOutput)
	}
	return manager.commands.Run(ctx, stdout, stderr, "journalctl", arguments...)
}

func (manager *ServiceManager) RecentErrors(ctx context.Context, limit int) ([]string, error) {
	output, err := manager.commands.Output(ctx, "journalctl", "--unit", serviceUnit, "--no-pager",
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
