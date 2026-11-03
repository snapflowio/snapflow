// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package console

import (
	"context"
	"errors"
	"fmt"

	"github.com/snapflowio/snapflow/internal/cli"
	"github.com/snapflowio/snapflow/internal/cli/text"
	"github.com/snapflowio/snapflow/internal/config"
	"github.com/snapflowio/snapflow/internal/console/admin"
	"github.com/snapflowio/snapflow/internal/console/view"
	"github.com/spf13/cobra"
)

const (
	followFlag     = "follow"
	serviceStarted = "started"
	serviceStopped = "stopped"
)

type serviceAction func(context.Context, *cli.Console, *admin.ServiceManager, bool) error

type serviceResult struct {
	Service string `json:"service"`
}

func newServiceCommand(application *App, help text.Help, action serviceAction) *cobra.Command {
	selection := cli.ProfileFlags{}
	jsonOutput := false
	command := &cobra.Command{
		Use: help.Use, Short: help.Short, Example: help.Example, GroupID: text.GroupOperate, Args: cobra.NoArgs,
	}
	command.RunE = application.action(command, func(console *cli.Console) error {
		ctx := command.Context()
		manager, err := systemService(selection)
		if err != nil {
			return err
		}
		return action(ctx, console, manager, jsonOutput)
	})
	selection.Register(command)
	command.Flags().BoolVar(&jsonOutput, jsonFlag, false, text.FlagJSON)
	return command
}

func systemService(selection cli.ProfileFlags) (*admin.ServiceManager, error) {
	profile, err := selection.Name()
	if err != nil {
		return nil, err
	}
	if profile == config.Development {
		return nil, cli.Fail(cli.ExitConfigurationError, errors.New(text.DevelopmentService), text.DevelopmentHint)
	}
	return admin.NewServiceManager(admin.ServiceManagerConfig{Commands: admin.ExecCommandRunner{}, Profile: profile})
}

func reportService(console *cli.Console, jsonOutput bool, state, title string) error {
	if jsonOutput {
		return writeJSON(console.Out, serviceResult{Service: state})
	}
	fmt.Fprintln(console.Out, view.Success(console.Theme, title))
	return nil
}

func newStartCommand(application *App) *cobra.Command {
	return newServiceCommand(application, text.HelpStart(),
		func(ctx context.Context, console *cli.Console, manager *admin.ServiceManager, jsonOutput bool) error {
			if err := manager.Start(ctx, console.Err, console.Err); err != nil {
				return err
			}
			return reportService(console, jsonOutput, serviceStarted, text.ServiceStartedTitle)
		})
}

func newStopCommand(application *App) *cobra.Command {
	return newServiceCommand(application, text.HelpStop(),
		func(ctx context.Context, console *cli.Console, manager *admin.ServiceManager, jsonOutput bool) error {
			if err := manager.Stop(ctx, console.Err, console.Err); err != nil {
				return err
			}
			return reportService(console, jsonOutput, serviceStopped, text.ServiceStoppedTitle)
		})
}

func newLogsCommand(application *App) *cobra.Command {
	follow := false
	command := newServiceCommand(application, text.HelpLogs(),
		func(ctx context.Context, console *cli.Console, manager *admin.ServiceManager, jsonOutput bool) error {
			return manager.Logs(ctx, console.Out, console.Err, admin.LogOptions{Follow: follow, JSON: jsonOutput})
		})
	command.Flags().BoolVarP(&follow, followFlag, "f", false, text.FlagFollow)
	return command
}
